"""Real native companion geometry, activation, and autostart; Xvfb baseline only."""
import native_driver as ui
import json, subprocess, time
try:
 ui.click('Explore Duby first');ui.click('Settings')
 ui.click('Top edge · experimental')
 ui.find('Open Duby',timeout=20)
 ui.find('Duby 3D companion, available.',timeout=20)
 windows=subprocess.check_output(['xdotool','search','--all','--onlyvisible','--pid',str(ui.app.pid),'--name','^Duby companion$'],text=True).splitlines()
 assert len(windows)==1
 geometry=subprocess.check_output(['xdotool','getwindowgeometry','--shell',windows[0]],text=True)
 values=dict(line.split('=',1) for line in geometry.splitlines() if '=' in line)
 assert int(values['WIDTH'])==210 and int(values['HEIGHT'])==238
 assert int(values['Y'])<=40 and int(values['X'])>800,values
 time.sleep(3)
 caption=ui.find('A little help, close by')
 caption_box=caption.get_component_iface().get_extents(ui.Atspi.CoordType.SCREEN)
 print('Native caption bounds:',caption_box.x,caption_box.y,caption_box.width,caption_box.height,flush=True)
 assert int(values['Y'])<=caption_box.y and caption_box.y+caption_box.height<=int(values['Y'])+238
 # Capture the composited desktop crop; a raw X window image can omit WebKit layers.
 subprocess.run(['import','-window','root','-crop',f"210x238+{values['X']}+{values['Y']}",'+repage',str(ui.root/'docs/evidence/native-companion.png')],check=True)
 # A positioned but blank canvas must not count as a rendered 3D companion.
 ui.gi.require_version('GdkPixbuf','2.0')
 from gi.repository import GdkPixbuf
 pixbuf=GdkPixbuf.Pixbuf.new_from_file(str(ui.root/'docs/evidence/native-companion.png'))
 pixels=pixbuf.get_pixels();channels=pixbuf.get_n_channels();stride=pixbuf.get_rowstride()
 # The left edge overlaps the light main window; sample the pet over the gray
 # desktop so the background alone cannot satisfy this visible-pixels assertion.
 bright=sum(1 for y in range(25,160) for x in range(85,185) if sum(pixels[y*stride+x*channels:y*stride+x*channels+3])>450)
 assert bright>600,'The native 3D surface is blank'
 caption_y=caption_box.y-int(values['Y'])
 ink=sum(1 for y in range(caption_y+4,caption_y+caption_box.height-4) for x in range(38,172) if sum(pixels[y*stride+x*channels:y*stride+x*channels+3])<300)
 assert ink>30,'The native caption is clipped or unreadable'
 main_windows=subprocess.check_output(['xdotool','search','--all','--onlyvisible','--pid',str(ui.app.pid),'--name','^Duby$'],text=True).splitlines()
 assert len(main_windows)==1
 subprocess.run(['xdotool','windowunmap',main_windows[0]],check=True)
 time.sleep(.5)
 assert subprocess.run(['xdotool','search','--all','--onlyvisible','--pid',str(ui.app.pid),'--name','^Duby$'],stdout=subprocess.DEVNULL).returncode!=0
 ui.click('Open Duby')
 ui.find('Your space')
 assert subprocess.run(['xdotool','search','--all','--onlyvisible','--pid',str(ui.app.pid),'--name','^Duby$'],stdout=subprocess.DEVNULL).returncode==0
 ui.click('Floating 3D companion')
 ui.find('Duby 3D companion, available.')
 ui.click('In this window')
 assert subprocess.run(['xdotool','search','--all','--onlyvisible','--pid',str(ui.app.pid),'--name','^Duby companion$'],stdout=subprocess.DEVNULL).returncode!=0
 ui.click('Autostart Open Duby when you sign in to this desktop.')
 entry=ui.state/'config/autostart/io.github.sidmuzammil.duby.desktop'
 deadline=time.monotonic()+5
 while not entry.exists() and time.monotonic()<deadline:time.sleep(.1)
 assert entry.exists() and 'Exec="' in entry.read_text()
 if ui.os.environ.get('APPIMAGE'):
  assert 'Exec="'+ui.os.environ['APPIMAGE']+'"' in entry.read_text(),'Autostart points to an ephemeral mounted binary'
 ui.click('Autostart Open Duby when you sign in to this desktop.')
 deadline=time.monotonic()+5
 while entry.exists() and time.monotonic()<deadline:time.sleep(.1)
 assert not entry.exists()
 ui.click('Quit Duby');ui.app.wait(timeout=10)
 evidence={'passed':True,'environment':'Xvfb X11 with xcompmgr, software rendering; no window manager','binary':ui.binary,'companionGeometry':{k:int(values[k]) for k in ['X','Y','WIDTH','HEIGHT']},'separate3DWindow':True,'renderedPetPixelsVerified':bright,'clickOpensMain':True,'switchToFloating':True,'hideClosesCompanion':True,'autostartEnableDisable':True,'portableAppImageAutostartPath':bool(ui.os.environ.get('APPIMAGE')),'gracefulQuit':True,'realDesktopMultiMonitorValidated':False,'gnomeWaylandValidated':False}
 (ui.root/'docs/evidence/native-companion.json').write_text(json.dumps(evidence,indent=2)+'\n')
 print('PASS native companion placement, main-window activation, autostart and graceful quit')
 ui.cleanup()
except Exception:
 subprocess.run(['import','-window','root','/workspace/duby-companion-failure.png'])
 raise
finally:ui.close()
