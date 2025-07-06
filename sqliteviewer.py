#!/usr/bin/env python3
import sqlite3
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os

class SQLiteHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.serve_main_page()
        elif self.path.startswith('/api/tables'):
            self.get_tables()
        elif self.path.startswith('/api/data'):
            self.get_table_data()
        else:
            self.send_error(404)
    
    def serve_main_page(self):
        html = '''<!DOCTYPE html>
<html><head><title>SQLite Viewer</title><style>
body { font-family: Arial; margin: 20px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background-color: #f2f2f2; }
.db-list { margin: 20px 0; }
.db-button { margin: 5px; padding: 10px 20px; background: #007cba; color: white; text-decoration: none; border-radius: 4px; }
</style></head><body>
<h1>📊 SQLite Database Viewer</h1>
<div class="db-list">
<h2>Available Databases:</h2>
<a href="#" class="db-button" onclick="loadDB('/var/www/pizza-system/backend/pizza_inventory.db')">Pizza Inventory</a>
<a href="#" class="db-button" onclick="loadDB('/var/www/pizza-system/backend/sessions.db')">Sessions</a>
<a href="#" class="db-button" onclick="loadDB('/var/www/pizza-system/backend/test.db')">Test DB</a>
</div>
<div id="content"></div>
<script>
function loadDB(db) {
    fetch('/api/tables?db=' + encodeURIComponent(db))
    .then(r => r.json())
    .then(data => {
        let html = '<h2>Tables in: ' + db + '</h2>';
        data.tables.forEach(table => {
            html += '<button onclick="loadTable(\\''+db+'\\', \\''+table+'\\')">'+table+'</button> ';
        });
        html += '<div id="tabledata"></div>';
        document.getElementById('content').innerHTML = html;
    });
}
function loadTable(db, table) {
    fetch('/api/data?db=' + encodeURIComponent(db) + '&table=' + encodeURIComponent(table))
    .then(r => r.json())
    .then(data => {
        let html = '<h3>Table: ' + table + '</h3><table><tr>';
        data.columns.forEach(col => html += '<th>'+col+'</th>');
        html += '</tr>';
        data.rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += '<td>'+(cell||'')+'</td>');
            html += '</tr>';
        });
        html += '</table>';
        document.getElementById('tabledata').innerHTML = html;
    });
}
</script></body></html>'''
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())
    
    def get_tables(self):
        query = parse_qs(urlparse(self.path).query)
        db_path = query.get('db', [None])[0]
        
        if not db_path or not os.path.exists(db_path):
            self.send_error(404)
            return
            
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'tables': tables}).encode())
        except Exception as e:
            self.send_error(500)
    
    def get_table_data(self):
        query = parse_qs(urlparse(self.path).query)
        db_path = query.get('db', [None])[0]
        table_name = query.get('table', [None])[0]
        
        if not db_path or not table_name:
            self.send_error(400)
            return
            
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 100")
            rows = cursor.fetchall()
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'columns': columns, 'rows': rows}).encode())
        except Exception as e:
            self.send_error(500)

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8082), SQLiteHandler)
    print("SQLite Viewer server running on http://0.0.0.0:8082")
    server.serve_forever()
