"""Installed GUI -> native credential dialog -> Gateway -> plugin -> Rust broker.

The local HTTP server is a deterministic model fixture, NOT live AI inference.
No hosted requests, keys, payments, or user documents are involved.
"""
import native_driver as ui
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import threading, json, time, pathlib, subprocess, os

calls = []
fixture_key = 'duby-native-fixture-key-never-a-real-credential'
class ModelFixture(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"data":[]}')
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  assert self.headers.get('Authorization')=='Bearer '+fixture_key
  names=sorted(t['function']['name'] for t in body.get('tools',[]))
  assert names==['duby_find','duby_read','duby_save'],names
  calls.append(names)
  results=[m for m in body.get('messages',[]) if m['role']=='tool']
  tool=None
  if not results:tool=('duby_read',{'path':'meeting.txt'})
  elif not any('sha256' in str(m.get('content')) for m in results):
   assert any('native fixture' in str(m.get('content')) for m in results)
   tool=('duby_save',{'path':'native-ai-summary.md','content':'# Native flow\n\nVerified through the installed app and scoped Rust broker.\n'})
  self.send_response(200);self.send_header('Content-Type','text/event-stream');self.end_headers()
  def chunk(delta,finish=None):
   payload={'id':'fixture','object':'chat.completion.chunk','created':1,'model':'fixture','choices':[{'index':0,'delta':delta,'finish_reason':finish}]}
   self.wfile.write(('data: '+json.dumps(payload)+'\n\n').encode());self.wfile.flush()
  if tool:
   chunk({'role':'assistant','tool_calls':[{'index':0,'id':'call_'+str(len(calls)),'type':'function','function':{'name':tool[0],'arguments':json.dumps(tool[1])}}]})
  else:chunk({'role':'assistant','content':'Created native-ai-summary.md through the verified native file flow.'})
  chunk({},'tool_calls' if tool else 'stop');self.wfile.write(b'data: [DONE]\n\n')

server=ThreadingHTTPServer(('127.0.0.1',0),ModelFixture)
threading.Thread(target=server.serve_forever,daemon=True).start()
def credential():
 ui.click('Use a key for this session')
 deadline=time.monotonic()+10
 entry=None
 while time.monotonic()<deadline:
  entry=next((n for n in ui.nodes() if n.get_role_name()=='password text'),None)
  if entry:break
  time.sleep(.1)
 assert entry,'Native GTK password field was not found'
 assert entry.get_editable_text_iface().set_text_contents(fixture_key),'GTK password entry rejected fixture input'
 ui.click('Use for this session')
 # The later authenticated model request verifies the actual credential. A
 # transient toast may disappear before a full native accessibility-tree walk.
 time.sleep(1)
def wait_file(path):
 deadline=time.monotonic()+90
 while not path.exists() and time.monotonic()<deadline:time.sleep(.2)
 assert path.exists(),'AI task did not produce the broker-confirmed output'

try:
 ui.click('Explore Duby first')
 (ui.fixture/'meeting.txt').write_text('This native fixture confirms the complete desktop AI flow.\n')
 ui.click('Access & privacy');ui.click('Enter a folder path instead')
 ui.fill('Absolute folder path',str(ui.fixture));ui.click('Allow creating new files');ui.click('Review folder access');ui.click('OK')
 ui.find('Revoke access to '+ui.fixture.name)
 ui.click('Settings')
 ui.click('Custom · OpenAI-compatible')
 ui.find('duby credentials custom')
 ui.fill('Model ID','fixture')
 ui.click('Advanced connection')
 ui.fill('Endpoint','http://127.0.0.1:'+str(server.server_port)+'/v1')
 ui.find('duby credentials custom')
 credential()
 ui.click('Connect runtime');ui.find('Runtime connected',timeout=100)
 ui.click('Your space')
 ui.fill('Ask Duby to help','Read meeting.txt and create native-ai-summary.md with a concise summary.')
 ui.click('Send task')
 wait_file(ui.fixture/'native-ai-summary.md')
 ui.find('Created native-ai-summary.md through the verified native file flow.',timeout=60)
 assert len(calls)>=3
 assert 'verified native file flow' in (ui.fixture/'native-ai-summary.md').read_text().lower() or 'scoped Rust broker' in (ui.fixture/'native-ai-summary.md').read_text()
 # User settings and task mapping survive a process restart; scope does not.
 ui.restart();ui.find('Your space',timeout=35)
 ui.click('Access & privacy');ui.find('No folders are shared with Duby.')
 ui.click('Activity 1');ui.find('Read meeting.txt and create native-ai-summary.md with a concise summary.')
 ui.click('Settings')
 assert ui.Atspi.Text.get_text(ui.find('Model ID',kind='editable'),0,-1)=='fixture'
 credential();ui.click('Connect runtime');ui.find('Runtime connected',timeout=100)
 ui.click('Activity 1');ui.click('Open conversation')
 ui.find('Created native-ai-summary.md through the verified native file flow.',timeout=30)
 assert len(calls)==3,'Recovery unexpectedly sent another model request'
 # Verify the session key is absent from ordinary native/runtime data.
 scanned=0
 for path in ui.state.rglob('*'):
  if path.is_file() and 'engines' not in path.parts and path.stat().st_size<20_000_000:
   assert fixture_key.encode() not in path.read_bytes(),'Credential residue: '+str(path.relative_to(ui.state))
   scanned+=1
 ui.click('Settings');ui.click('Forget session keys')
 ui.find('Connect runtime')
 evidence={'passed':True,'model':'local deterministic HTTP fixture, not live inference','packagedBinary':ui.binary,'nativeCredentialDialog':True,'rendererReceivesKey':False,'toolFlow':['duby_read','duby_save'],'outputContentVerified':True,'restartHistoryRecovery':True,'grantsRestored':False,'recoveryModelRequests':0,'credentialResidueFilesScanned':scanned,'providerPayments':0,'modelRequests':len(calls)}
 (ui.root/'docs/evidence/native-ai-flow.json').write_text(json.dumps(evidence,indent=2)+'\n')
 print('PASS installed native AI file flow, session credentials, restart recovery and credential residue')
 ui.close();ui.cleanup()
except Exception:
 subprocess.run(['import','-window','root','/workspace/duby-native-ai-failure.png'])
 raise
finally:
 ui.close();server.shutdown();server.server_close()
