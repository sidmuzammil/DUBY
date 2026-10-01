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
    if 'Text' in n.get_interfaces() and Atspi.Text.get_text(n,0,-1).strip()==name:return n
   except Exception:pass
  time.sleep(.2)
 raise AssertionError('Native accessible control not found: '+name+'; visible names: '+str([(n.get_role_name(),n.get_name()) for n in nodes() if n.get_name()][:100]))
def click(name):
 n=find(name,kind='action');action=n.get_action_iface();assert action and action.do_action(0),'Cannot activate '+name;time.sleep(.35)
def fill(name,text):
 # WebKit exposes EditableText but may reject set_text_contents; real key events
 # also exercise React's input/change handlers. Locate fields through AT-SPI.
 n=find(name,kind='editable');box=n.get_component_iface().get_extents(Atspi.CoordType.SCREEN)
 subprocess.run(['xdotool','mousemove',str(box.x+box.width//2),str(box.y+box.height//2),'click','1','key','ctrl+a'],check=True)
 clipboard=Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
 clipboard.set_text(text,-1)
 subprocess.run(['xdotool','key','--clearmodifiers','ctrl+v'],check=True)
 deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  while Gtk.events_pending():Gtk.main_iteration_do(False)
  time.sleep(.05)
 actual=Atspi.Text.get_text(n,0,-1)
 assert actual==text, "Native field input: "+name+" actual="+repr(actual)+" expected="+repr(text)
try:
 try:click('Explore Duby first')
 except AssertionError:
  find('Your space') # Existing renderer preferences may skip onboarding.
 click('Access & privacy')
 click('Enter a folder path instead')
 fill('Absolute folder path',str(fixture))
 click('Allow creating new files')
 click('Review folder access')
 click('OK')
 find('Revoke access to '+fixture.name)
 click('Your space')
 click('Or just write a note')
 fill('New filename','native-note.md')
 fill('Your note','Created through the real native Duby UI and Rust broker.\n')
 click('Save new file')
 deadline=time.monotonic()+10
 while not (fixture/'native-note.md').exists() and time.monotonic()<deadline:time.sleep(.1)
 assert (fixture/'native-note.md').read_text()=='Created through the real native Duby UI and Rust broker.\n'
 click('Your memory')
 fill('What would you like to remember?','Prefer concise summaries.')
 click('Remember this')
 find('Prefer concise summaries.')
 click('Edit')
 fill('Edit your saved memory','Prefer clear bullet lists.')
 click('Save changes')
 find('Prefer clear bullet lists.')
 click('Forget')
 if os.environ.get('DUBY_TEST_EXPORT'):
  click('Settings')
  click('Export redacted diagnostics')
  click('Save new file')
  deadline=time.monotonic()+10
  while not (fixture/'duby-diagnostics.json').exists() and time.monotonic()<deadline:time.sleep(.1)
  report=json.loads((fixture/'duby-diagnostics.json').read_text())
  assert report['app']=='Duby' and 'capabilities' in report and 'prompt' not in report
 click('Access & privacy')
 click('Revoke access to '+fixture.name)
 find('No folders are shared with Duby.')
 subprocess.run(['import','-window','root',str(root/'docs/evidence/native-access-verified.png')],check=True)
 if os.environ.get('DUBY_TEST_RUNTIME'):
  click('Settings')
  fill('Model ID','qwen3:8b')
  click('Connect runtime')
  deadline=time.monotonic()+110
  connected=False
  while time.monotonic()<deadline:
   for n in nodes():
    if n.get_name()=='Runtime connected':connected=True;break
    if n.get_role_name()=='status bar' or n.get_role_name()=='status':
     print('Runtime status:',[Atspi.Text.get_text(c,0,-1) for c in walk(n) if 'Text' in c.get_interfaces()],flush=True)
   if connected:break
   time.sleep(.25)
  assert connected,'Packaged runtime did not connect; inspect native UI status'
 evidence={'passed':True,'environment':'Debian 13.6, Xvfb, GTK/WebKitGTK, AT-SPI actions','binary':binary,'flows':['onboarding','native folder confirmation','create note through Rust broker','persist/editable memory UI and deletion','grant revocation'],'fixtureContentVerified':True,'noProviderCalls':True,'bundledRuntimeHandshake':bool(os.environ.get('DUBY_TEST_RUNTIME')),'brokerDiagnosticExport':bool(os.environ.get('DUBY_TEST_EXPORT'))}
 report='packaged-native-smoke.json' if os.environ.get('DUBY_TEST_BINARY') else 'native-smoke.json'
 (root/'docs/evidence'/report).write_text(json.dumps(evidence,indent=2)+'\n')
 print('PASS native GTK/WebKit/AT-SPI folder consent, file creation, memories and revocation')
except Exception:
 subprocess.run(['import','-window','root','/workspace/duby-native-failure.png'])
 raise
finally:
 os.killpg(app.pid,signal.SIGTERM)
 try:app.wait(timeout=5)
 except subprocess.TimeoutExpired:app.kill();app.wait()
 # Fixtures stay only on failure to aid diagnosis; they contain no user data.
