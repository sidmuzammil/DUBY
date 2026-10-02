//! Integration fixture only. Authority is configured by the test runner, never a model.
use duby_broker::{Broker, Request};
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    os::unix::net::UnixListener,
    path::Path,
};
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let root = Path::new(&args[1]);
    let socket = &args[2];
    let mut broker = Broker::new(&root.join("test.sqlite")).unwrap();
    let grant = broker.grant(root, true, 300).unwrap();
    broker
        .task("agent:duby:duby:integration", &grant.id)
        .unwrap();
    let listener = UnixListener::bind(socket).unwrap();
    println!("ready");
    for stream in listener.incoming() {
        let mut stream = stream.unwrap();
        let mut line = String::new();
        BufReader::new(&stream).read_line(&mut line).unwrap();
        let result = (|| -> Result<Value, String> {
            let v: Value = serde_json::from_str(&line).map_err(|e| e.to_string())?;
            if v["token"] != "fixture-broker-token" {
                return Err("Authentication failed".into());
            }
            let req: Request =
                serde_json::from_value(v["request"].clone()).map_err(|e| e.to_string())?;
            broker.execute(req)
        })();
        writeln!(
            stream,
            "{}",
            match result {
                Ok(v) => json!({"result":v}),
                Err(e) => json!({"error":e}),
            }
        )
        .unwrap();
    }
}
