"""Native GTK/WebKit/AT-SPI smoke. Run inside a fresh DBus session and Xvfb.
Uses only its own temporary fixture and app data, never the user's documents.
"""
import gi,os,time,subprocess,tempfile,pathlib,json,signal,ast

os.environ['AT_SPI_BUS_ADDRESS']=ast.literal_eval(subprocess.check_output(['gdbus','call','--session','--dest','org.a11y.Bus','--object-path','/org/a11y/bus','--method','org.a11y.Bus.GetAddress'],text=True))[0]
gi.require_version('Atspi','2.0')
gi.require_version('Gtk','3.0')
from gi.repository import Atspi,Gtk,Gdk
root=pathlib.Path(__file__).resolve().parents[1]
fixture=pathlib.Path(tempfile.mkdtemp(prefix='duby-native-fixture-'))
state=pathlib.Path(os.environ.get('DUBY_TEST_STATE') or tempfile.mkdtemp(prefix='duby-native-state-'))
environ=os.environ.copy()
for kind in ['DATA','CONFIG','CACHE']:environ['XDG_'+kind+'_HOME']=str(state/kind.lower())
binary=os.environ.get('DUBY_TEST_BINARY',str(root/'target/debug/duby'))
app=subprocess.Popen([binary],env=environ,start_new_session=True,stdout=subprocess.DEVNULL,stderr=open('/workspace/duby-native-smoke.log','w'))

def walk(node,depth=0):
 if depth>25:return
 yield node
 try:
  for i in range(min(node.get_child_count(),200)):
   child=node.get_child_at_index(i)
   if child:yield from walk(child,depth+1)
 except Exception:pass

def nodes():
 desktop=Atspi.get_desktop(0)
 for i in range(desktop.get_child_count()):
  application=desktop.get_child_at_index(i)
  if application.get_process_id()==app.pid:return list(walk(application))
 return []
def find(name,timeout=25,kind=None):
 deadline=time.monotonic()+timeout
 while time.monotonic()<deadline:
  if app.poll() is not None:raise AssertionError("Native app exited; inspect duby-native-smoke.log")
  for n in nodes():
   try:
    if kind=='editable' and not n.get_state_set().contains(Atspi.StateType.EDITABLE):continue
    if kind=='action' and 'Action' not in n.get_interfaces():continue
    if n.get_name()==name:return n
    if any(i in n.get_interfaces() for i in ['Text','Hypertext']) and Atspi.Text.get_text(n,0,-1).strip()==name:return n
   except Exception:pass
  time.sleep(.2)
 raise AssertionError('Native accessible control not found: '+name+'; visible names: '+str([(n.get_role_name(),n.get_name()) for n in nodes() if n.get_name()][:100]))
def click(name):
 print('Native action:',name,flush=True)
 n=find(name,kind='action')
 assert n.get_component_iface().grab_focus(),'Cannot focus native input '+name
 time.sleep(.15)
 action=n.get_action_iface();assert action and action.do_action(0),'Cannot activate '+name;time.sleep(.35)
def fill(name,text):
 print('Native field:',name,flush=True)
 # WebKit exposes EditableText but may reject set_text_contents; real key events
 # also exercise React's input/change handlers. Locate fields through AT-SPI.
 n=find(name,kind='editable')
 editable=n.get_editable_text_iface()
 if editable and editable.set_text_contents(text):
  time.sleep(.5)
  if Atspi.Text.get_text(n,0,-1)==text:return
 # Xvfb has no window manager to restore keyboard focus after a GTK modal.
 windows=subprocess.check_output(['xdotool','search','--all','--onlyvisible','--pid',str(app.pid),'--name','^Duby$'],text=True).splitlines()
 if windows:subprocess.run(['xdotool','windowfocus','--sync',windows[-1]],check=True)
 n.get_component_iface().grab_focus()
 time.sleep(.25)
 try:n.get_component_iface().scroll_to(Atspi.ScrollType.TOP_EDGE)
 except Exception:pass
 time.sleep(.25)
 box=n.get_component_iface().get_extents(Atspi.CoordType.SCREEN)
 for _ in range(6):
  if 70 < box.y+box.height//2 < 650:break
  subprocess.run(['xdotool','mousemove','1080','450','click','--repeat','3','--delay','100','5' if box.y>600 else '4'],check=True)
  time.sleep(.4)
  box=n.get_component_iface().get_extents(Atspi.CoordType.SCREEN)
 print('Native input rectangle:',name,box.x,box.y,box.width,box.height,flush=True)
 subprocess.run(['xdotool','mousemove',str(box.x+box.width//2),str(box.y+box.height//2),'click','1'],check=True)
 time.sleep(.3)
 subprocess.run(['xdotool','key','ctrl+a'],check=True)
 clipboard=Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
 clipboard.set_text(text,-1)
 subprocess.run(['xdotool','key','--clearmodifiers','ctrl+v'],check=True)
 deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  while Gtk.events_pending():Gtk.main_iteration_do(False)
  time.sleep(.05)
 actual=Atspi.Text.get_text(n,0,-1)
 assert actual==text, "Native field input: "+name+" actual="+repr(actual)+" expected="+repr(text)

def close():
 if app.poll() is None:
  os.killpg(app.pid,signal.SIGTERM)
  try:app.wait(timeout=8)
  except subprocess.TimeoutExpired:app.kill();app.wait()

def restart():
 global app
 close()
 app=subprocess.Popen([binary],env=environ,start_new_session=True,stdout=subprocess.DEVNULL,stderr=open("/workspace/duby-native-smoke.log","a"))

def select(name,index):
 combo=find(name,kind='action')
 items=[n for n in walk(combo) if n.get_role_name()=='menu item']
 if len(items)>index:
  windows=subprocess.check_output(['xdotool','search','--all','--onlyvisible','--pid',str(app.pid),'--name','^Duby$'],text=True).splitlines()
  if windows:subprocess.run(['xdotool','windowfocus','--sync',windows[-1]],check=True)
  assert combo.get_component_iface().grab_focus(),'Cannot focus '+name
  subprocess.run(['xdotool','key','--clearmodifiers','End'],check=True)
  time.sleep(.4)
  for _ in range(len(items)-1-index):
   subprocess.run(['xdotool','key','--clearmodifiers','Up'],check=True)
   time.sleep(.3)
  subprocess.run(['xdotool','key','Tab'],check=True)
  time.sleep(1)
  return
 n=next((x for x in nodes() if x.get_name()==name and 'Selection' in x.get_interfaces()),None)
 if n and n.get_selection_iface().select_child(index):
  time.sleep(1)
  return
 n=find(name,kind='action')
 box=n.get_component_iface().get_extents(Atspi.CoordType.SCREEN)
 subprocess.run(['xdotool','mousemove',str(box.x+box.width//2),str(box.y+box.height//2),'click','1','key','Home'],check=True)
 time.sleep(.5)
 for _ in range(index):
  subprocess.run(['xdotool','key','Down'],check=True)
  time.sleep(.25)
 subprocess.run(['xdotool','key','Return'],check=True)
 time.sleep(1)


def cleanup():
 import shutil
 shutil.rmtree(fixture,ignore_errors=True)
 if not os.environ.get('DUBY_TEST_STATE'):
  shutil.rmtree(state,ignore_errors=True)
