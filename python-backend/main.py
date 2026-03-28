"""Entry point — run with: python python-backend/main.py"""
import sys
import os

# Allow importing sibling packages when run as a script
sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from server.app import create_app
from config import HOST, PORT

app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
    )
