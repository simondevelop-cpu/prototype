#!/usr/bin/env python3
"""
Simple test server to verify authentication endpoints work correctly.
This simulates the Node.js server behavior for testing.
"""

import json
import hashlib
import time
import base64
import hmac
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os

# Demo user data
DEMO_USER = {
    "id": "demo-user",
    "name": "Taylor Nguyen", 
    "email": "demo@canadianinsights.ca",
    "passwordHash": hashlib.sha256("northstar-demo".encode()).hexdigest()
}

users = [DEMO_USER]
users_by_id = {user["id"]: user for user in users}

JWT_SECRET = "canadian-insights-demo-secret"
SESSION_TTL_SECONDS = 60 * 60 * 2  # 2 hours

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user):
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip('=')
    payload = base64.urlsafe_b64encode(json.dumps({
        "sub": user["id"], 
        "exp": int(time.time()) + SESSION_TTL_SECONDS
    }).encode()).decode().rstrip('=')
    
    signature = hmac.new(
        JWT_SECRET.encode(),
        f"{header}.{payload}".encode(),
        hashlib.sha256
    ).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip('=')
    
    return f"{header}.{payload}.{signature_b64}"

def public_user(user):
    return {"id": user["id"], "name": user["name"], "email": user["email"]}

class AuthTestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/auth/login':
            self.handle_login()
        elif parsed_path.path == '/api/auth/demo':
            self.handle_demo()
        elif parsed_path.path == '/api/auth/register':
            self.handle_register()
        else:
            self.send_error(404, "Not Found")
    
    def handle_login(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            email = data.get('email', '').strip()
            password = data.get('password', '').strip()
            
            if not email or not password:
                self.send_json_response(400, {"error": "Email and password are required"})
                return
            
            # Find user
            user = None
            for u in users:
                if u["email"].lower() == email.lower():
                    user = u
                    break
            
            if not user:
                self.send_json_response(401, {"error": "Invalid credentials"})
                return
            
            # Verify password
            if hash_password(password) != user["passwordHash"]:
                self.send_json_response(401, {"error": "Invalid credentials"})
                return
            
            token = create_token(user)
            self.send_json_response(200, {"token": token, "user": public_user(user)})
            
        except Exception as e:
            print(f"Login error: {e}")
            self.send_json_response(500, {"error": "Unable to sign in"})
    
    def handle_demo(self):
        try:
            user = users[0]  # Demo user
            token = create_token(user)
            self.send_json_response(200, {"token": token, "user": public_user(user)})
        except Exception as e:
            print(f"Demo login error: {e}")
            self.send_json_response(500, {"error": "Unable to start demo session"})
    
    def handle_register(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            email = data.get('email', '').strip()
            password = data.get('password', '').strip()
            name = data.get('name', '').strip()
            
            if not email or not password or not name:
                self.send_json_response(400, {"error": "Email, password, and name are required"})
                return
            
            # Check if user exists
            for user in users:
                if user["email"].lower() == email.lower():
                    self.send_json_response(409, {"error": "User already exists with this email"})
                    return
            
            # Create new user
            new_user = {
                "id": f"user-{int(time.time())}-{hash(email)[:9]}",
                "email": email.lower(),
                "name": name,
                "passwordHash": hash_password(password)
            }
            
            users.append(new_user)
            users_by_id[new_user["id"]] = new_user
            
            token = create_token(new_user)
            self.send_json_response(201, {"token": token, "user": public_user(new_user)})
            
        except Exception as e:
            print(f"Registration error: {e}")
            self.send_json_response(500, {"error": "Unable to create account"})
    
    def send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == '__main__':
    port = 3000
    server = HTTPServer(('localhost', port), AuthTestHandler)
    print(f"Auth test server running on http://localhost:{port}")
    print("Test endpoints:")
    print(f"  POST http://localhost:{port}/api/auth/login")
    print(f"  POST http://localhost:{port}/api/auth/demo") 
    print(f"  POST http://localhost:{port}/api/auth/register")
    print("\nDemo credentials:")
    print("  Email: demo@canadianinsights.ca")
    print("  Password: northstar-demo")
    print("\nPress Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
        server.shutdown()
