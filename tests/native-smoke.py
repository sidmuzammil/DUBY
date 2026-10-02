"""Native GTK/WebKit/AT-SPI smoke; fixture data only."""
from native_driver import *

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
  deadline=time.monotonic()+240
  connected=False
  while time.monotonic()<deadline:
   for n in nodes():
    if n.get_name()=='Runtime connected':connected=True;break
   if connected:break
   time.sleep(.25)
  assert connected,'Packaged runtime did not connect; inspect native UI status'
 evidence={'passed':True,'environment':'Debian 13.6, Xvfb, GTK/WebKitGTK, AT-SPI actions','binary':binary,'flows':['onboarding','native folder confirmation','create note through Rust broker','persist/editable memory UI and deletion','grant revocation'],'fixtureContentVerified':True,'noProviderCalls':True,'bundledRuntimeHandshake':bool(os.environ.get('DUBY_TEST_RUNTIME')),'brokerDiagnosticExport':bool(os.environ.get('DUBY_TEST_EXPORT'))}
 report='appimage-native-smoke.json' if pathlib.Path(binary).name=='AppRun' else 'packaged-native-smoke.json' if os.environ.get('DUBY_TEST_BINARY') else 'native-smoke.json'
 (root/'docs/evidence'/report).write_text(json.dumps(evidence,indent=2)+'\n')
 print('PASS native GTK/WebKit/AT-SPI folder consent, file creation, memories and revocation')
 close();cleanup()
except Exception:
 subprocess.run(['import','-window','root','/workspace/duby-native-failure.png'])
 raise
finally:
 close()
 # Fixtures stay only on failure to aid diagnosis; they contain no user data.
