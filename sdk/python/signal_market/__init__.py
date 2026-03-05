"""
Signal Market Python SDK

Usage:
    from signal_market import SignalMarket
    
    client = SignalMarket(api_key="your-key")
    
    # Get events
    events = client.get_events()
    
    # Get daily brief
    brief = client.get_lens_brief("lens_a_stock")
    
    # Get health
    health = client.health_check()
"""

import requests
from typing import Dict, List, Optional, Any


class SignalMarket:
    """Signal Market API Client"""
    
    def __init__(self, api_key: str = "", base_url: str = "http://localhost:3000"):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        if api_key:
            self.session.headers.update({"Authorization": f"Bearer {api_key}"})
    
    def get_events(self) -> Dict[str, Any]:
        """Get all active events"""
        resp = self.session.get(f"{self.base_url}/events")
        resp.raise_for_status()
        return resp.json()
    
    def get_event_probability(self, event_id: str) -> Dict[str, Any]:
        """Get probability curve for an event"""
        resp = self.session.get(f"{self.base_url}/events/{event_id}/probability")
        resp.raise_for_status()
        return resp.json()
    
    def get_lens_brief(self, user_id: str) -> Dict[str, Any]:
        """Get daily brief for a user lens"""
        resp = self.session.get(f"{self.base_url}/lenses/{user_id}/daily-brief")
        resp.raise_for_status()
        return resp.json()
    
    def create_watch(self, topic: str, market: str, delivery: str = "08:30", 
                    objective: str = "opportunity") -> Dict[str, Any]:
        """Create a new watch"""
        data = {
            "topic": topic,
            "market": market,
            "delivery": delivery,
            "objective": objective
        }
        resp = self.session.post(f"{self.base_url}/watch", json=data)
        resp.raise_for_status()
        return resp.json()
    
    def health_check(self) -> Dict[str, Any]:
        """Check system health"""
        resp = self.session.get(f"{self.base_url}/signals/health")
        resp.raise_for_status()
        return resp.json()
    
    def get_evidence(self, event_id: str) -> Dict[str, Any]:
        """Get evidence for an event"""
        resp = self.session.get(f"{self.base_url}/evidence/{event_id}")
        resp.raise_for_status()
        return resp.json()


# Convenience function
def create_client(api_key: str = "", base_url: str = "http://localhost:3000") -> SignalMarket:
    """Create a Signal Market client"""
    return SignalMarket(api_key, base_url)


if __name__ == "__main__":
    # Example usage
    client = create_client()
    
    print("=== Health Check ===")
    print(client.health_check())
    
    print("\n=== Events ===")
    print(client.get_events())
    
    print("\n=== Lens Brief (A股) ===")
    print(client.get_lens_brief("lens_a_stock"))
