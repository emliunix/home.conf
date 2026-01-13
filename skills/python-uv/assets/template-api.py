#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "requests>=2.31.0",
#   "python-dotenv>=1.0.0",
# ]
# requires-python = ">=3.11"
# ///
"""
API Client Template

A template for making API requests with authentication support.
Uses environment variables for sensitive credentials.
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class APIClient:
    """Simple API client with authentication."""

    def __init__(self, base_url, api_key=None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key or os.getenv("API_KEY")
        self.session = requests.Session()

        if self.api_key:
            # Configure authentication (adjust for your API)
            self.session.headers.update(
                {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
            )

    def get(self, endpoint, params=None):
        """Make GET request to API endpoint."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        response = self.session.get(url, params=params)
        response.raise_for_status()
        return response.json()

    def post(self, endpoint, data=None):
        """Make POST request to API endpoint."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        response = self.session.post(url, json=data)
        response.raise_for_status()
        return response.json()


def main():
    # Example usage
    base_url = os.getenv("API_BASE_URL", "https://api.example.com")

    if not os.getenv("API_KEY"):
        print("Warning: API_KEY not found in environment")
        print("Create a .env file with: API_KEY=your_key_here")

    # Create client
    client = APIClient(base_url)

    # Example GET request
    try:
        data = client.get("/endpoint")
        print("Response:")
        print(json.dumps(data, indent=2))
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
