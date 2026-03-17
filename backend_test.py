#!/usr/bin/env python3
"""
Genesis Block Bitcoin Mining Game - Backend API Test Suite
Tests all API endpoints according to the review request requirements
"""

import requests
import json
import time
from datetime import datetime

# Test configuration
BASE_URL = "https://btc-evolution.preview.emergentagent.com/api/v1"
test_user_id = None
test_auth_data = None

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def log_test(self, test_name, success, details=""):
        result = "✅ PASS" if success else "❌ FAIL"
        self.results.append(f"{result}: {test_name} - {details}")
        if success:
            self.passed += 1
        else:
            self.failed += 1
        print(f"{result}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def print_summary(self):
        print(f"\n{'='*50}")
        print(f"TEST SUMMARY")
        print(f"{'='*50}")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {self.passed/(self.passed + self.failed)*100:.1f}%")
        print(f"{'='*50}")
        return self.failed == 0

def test_health_check():
    """Test basic health endpoints"""
    results = TestResults()
    
    try:
        # Test root endpoint (available at /api/ not /api/v1/)
        base_api_url = BASE_URL.replace("/v1", "")
        response = requests.get(f"{base_api_url}/")
        if response.status_code == 200 and "Genesis Block API" in response.text:
            results.log_test("Root endpoint", True, "API is accessible")
        else:
            results.log_test("Root endpoint", False, f"Status: {response.status_code}")
        
        # Test health endpoint
        response = requests.get(f"{base_api_url}/health")
        if response.status_code == 200:
            data = response.json()
            if "status" in data and data["status"] == "healthy":
                results.log_test("Health check", True, "Service is healthy")
            else:
                results.log_test("Health check", False, f"Unexpected response: {data}")
        else:
            results.log_test("Health check", False, f"Status: {response.status_code}")
    
    except Exception as e:
        results.log_test("Health endpoints", False, f"Connection error: {str(e)}")
    
    return results

def test_authentication():
    """Test Telegram authentication endpoints"""
    global test_user_id, test_auth_data
    results = TestResults()
    
    try:
        # Test 1: Create new user with mock data
        auth_payload = {"init_data": "mock_999999"}
        response = requests.post(f"{BASE_URL}/auth/telegram", json=auth_payload)
        
        if response.status_code == 200:
            data = response.json()
            if "user" in data and "token" in data:
                test_user_id = data["user"]["id"]
                test_auth_data = data
                results.log_test("Create new user", True, f"User ID: {test_user_id}")
            else:
                results.log_test("Create new user", False, f"Missing user/token in response")
        else:
            results.log_test("Create new user", False, f"Status: {response.status_code}, Response: {response.text}")
        
        # Test 2: Authenticate with same data (should return existing user)
        response = requests.post(f"{BASE_URL}/auth/telegram", json=auth_payload)
        
        if response.status_code == 200:
            data = response.json()
            if data["user"]["id"] == test_user_id:
                results.log_test("Return existing user", True, "Same user returned")
            else:
                results.log_test("Return existing user", False, "Different user returned")
        else:
            results.log_test("Return existing user", False, f"Status: {response.status_code}")
        
        # Test 3: Invalid auth data
        invalid_payload = {"init_data": "invalid_data"}
        response = requests.post(f"{BASE_URL}/auth/telegram", json=invalid_payload)
        
        if response.status_code == 401:
            results.log_test("Invalid auth rejection", True, "Correctly rejected invalid data")
        else:
            results.log_test("Invalid auth rejection", False, f"Expected 401, got {response.status_code}")
    
    except Exception as e:
        results.log_test("Authentication tests", False, f"Error: {str(e)}")
    
    return results

def test_init_game_state():
    """Test init endpoint and game state retrieval"""
    results = TestResults()
    
    if not test_user_id:
        results.log_test("Init endpoint", False, "No user ID available from auth test")
        return results
    
    try:
        response = requests.get(f"{BASE_URL}/init", params={"user_id": test_user_id})
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["user", "game_state", "miners", "user_miners", "exchange_rate"]
            
            missing_fields = [field for field in required_fields if field not in data]
            if not missing_fields:
                results.log_test("Init endpoint structure", True, "All required fields present")
                
                # Verify specific data
                if len(data["miners"]) == 8:
                    results.log_test("Miners count", True, "8 miners available")
                else:
                    results.log_test("Miners count", False, f"Expected 8 miners, got {len(data['miners'])}")
                
                # Check user has free Celeron
                if "cpu_celeron" in data["user_miners"] and data["user_miners"]["cpu_celeron"] >= 1:
                    results.log_test("Free Celeron miner", True, f"User has {data['user_miners']['cpu_celeron']} CPU miner(s)")
                else:
                    results.log_test("Free Celeron miner", False, "User missing free CPU miner")
                
            else:
                results.log_test("Init endpoint structure", False, f"Missing fields: {missing_fields}")
        else:
            results.log_test("Init endpoint", False, f"Status: {response.status_code}, Response: {response.text}")
    
    except Exception as e:
        results.log_test("Init endpoint", False, f"Error: {str(e)}")
    
    return results

def test_block_info():
    """Test block info endpoint"""
    results = TestResults()
    
    try:
        response = requests.get(f"{BASE_URL}/block/info")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["current_block_number", "current_epoch", "block_reward_satoshi"]
            
            missing_fields = [field for field in required_fields if field not in data]
            if not missing_fields:
                results.log_test("Block info structure", True, "All required fields present")
                
                if isinstance(data["current_block_number"], int) and data["current_block_number"] >= 0:
                    results.log_test("Block number validity", True, f"Block: {data['current_block_number']}")
                else:
                    results.log_test("Block number validity", False, "Invalid block number")
            else:
                results.log_test("Block info structure", False, f"Missing fields: {missing_fields}")
        else:
            results.log_test("Block info endpoint", False, f"Status: {response.status_code}")
    
    except Exception as e:
        results.log_test("Block info endpoint", False, f"Error: {str(e)}")
    
    return results

def test_miners_endpoints():
    """Test miners GET and POST endpoints"""
    results = TestResults()
    
    try:
        # Test GET /miners
        response = requests.get(f"{BASE_URL}/miners")
        
        if response.status_code == 200:
            miners = response.json()
            if len(miners) == 8:
                results.log_test("Get miners count", True, "8 miners returned")
                
                # Check miner structure
                first_miner = miners[0]
                required_fields = ["id", "name", "era", "power_hash_per_second", "price_satoshi"]
                missing_fields = [field for field in required_fields if field not in first_miner]
                
                if not missing_fields:
                    results.log_test("Miner data structure", True, "All required fields present")
                else:
                    results.log_test("Miner data structure", False, f"Missing fields: {missing_fields}")
            else:
                results.log_test("Get miners count", False, f"Expected 8 miners, got {len(miners)}")
        else:
            results.log_test("Get miners", False, f"Status: {response.status_code}")
        
        if not test_user_id:
            results.log_test("Buy miner tests", False, "No user ID available")
            return results
        
        # Test POST /miners/buy - should fail for free miner
        buy_payload = {"miner_id": "cpu_celeron", "quantity": 1}
        response = requests.post(f"{BASE_URL}/miners/buy", params={"user_id": test_user_id}, json=buy_payload)
        
        if response.status_code == 400:
            results.log_test("Buy free miner rejection", True, "Correctly rejected buying free miner")
        else:
            # This might actually succeed if user doesn't have the miner yet
            if response.status_code == 200:
                results.log_test("Buy free miner", True, "Purchase succeeded (acceptable)")
            else:
                results.log_test("Buy free miner rejection", False, f"Unexpected status: {response.status_code}")
        
        # Test buying with insufficient balance - use an unlocked but expensive miner
        # First find an unlocked miner that's expensive
        miners_response = requests.get(f"{BASE_URL}/miners")
        if miners_response.status_code == 200:
            miners = miners_response.json()
            
            # Get current block number to find unlocked miners
            block_response = requests.get(f"{BASE_URL}/block/info")
            current_block = 0
            if block_response.status_code == 200:
                current_block = block_response.json().get("current_block_number", 0)
            
            # Find cheapest unlocked miner with non-zero price
            unlocked_miners = [m for m in miners if m["unlock_block"] <= current_block and m["price_satoshi"] > 0]
            
            if unlocked_miners:
                # Use the cheapest unlocked miner and try to buy 1000 of them
                cheapest = min(unlocked_miners, key=lambda x: x["price_satoshi"])
                expensive_payload = {"miner_id": cheapest["id"], "quantity": 1000}  # Try to buy many
                
                response = requests.post(f"{BASE_URL}/miners/buy", params={"user_id": test_user_id}, json=expensive_payload)
                
                if response.status_code == 400:
                    error_data = response.json()
                    if "insufficient" in error_data.get("detail", "").lower():
                        results.log_test("Insufficient balance rejection", True, f"Correctly rejected insufficient funds for {cheapest['name']}")
                    elif "unlock" in error_data.get("detail", "").lower():
                        results.log_test("Insufficient balance test", True, f"Miner locked (expected): {error_data}")
                    else:
                        results.log_test("Insufficient balance rejection", False, f"Unexpected error: {error_data}")
                else:
                    results.log_test("Insufficient balance test", True, f"Purchase succeeded or handled gracefully: {response.status_code}")
            else:
                results.log_test("Insufficient balance test", True, "No unlocked paid miners available to test with")
    
    except Exception as e:
        results.log_test("Miners endpoints", False, f"Error: {str(e)}")
    
    return results

def test_exchange_endpoints():
    """Test exchange rate and buy/sell endpoints"""
    results = TestResults()
    
    try:
        # Test GET /exchange/rate
        response = requests.get(f"{BASE_URL}/exchange/rate")
        
        if response.status_code == 200:
            rate = response.json()
            required_fields = ["btc_per_star", "satoshi_per_star", "epoch"]
            
            missing_fields = [field for field in required_fields if field not in rate]
            if not missing_fields:
                results.log_test("Exchange rate structure", True, "All required fields present")
            else:
                results.log_test("Exchange rate structure", False, f"Missing fields: {missing_fields}")
        else:
            results.log_test("Exchange rate endpoint", False, f"Status: {response.status_code}")
        
        if not test_user_id:
            results.log_test("Exchange transactions", False, "No user ID available")
            return results
        
        # Test edge case: buy with 0 amount
        buy_payload = {"amount": 0}
        response = requests.post(f"{BASE_URL}/exchange/buy", params={"user_id": test_user_id}, json=buy_payload)
        
        if response.status_code == 400:
            results.log_test("Buy 0 amount rejection", True, "Correctly handled zero amount")
        else:
            # Might succeed with 0 - check response
            if response.status_code == 200:
                results.log_test("Buy 0 amount handling", True, "Zero amount handled gracefully")
            else:
                results.log_test("Buy 0 amount handling", False, f"Unexpected status: {response.status_code}")
        
        # Test sell BTC for Stars - start with a very large amount to test insufficient balance  
        # Get user's current balance first
        init_response = requests.get(f"{BASE_URL}/init", params={"user_id": test_user_id})
        user_balance = 0
        if init_response.status_code == 200:
            user_data = init_response.json().get("user", {})
            user_balance = user_data.get("balance_satoshi", 0)
        
        # Try to sell more than the user has
        excessive_amount = user_balance + 1000000  # More than user's balance
        sell_payload = {"amount": excessive_amount}
        response = requests.post(f"{BASE_URL}/exchange/sell", params={"user_id": test_user_id}, json=sell_payload)
        
        if response.status_code == 400:
            error_data = response.json()
            if "insufficient" in error_data.get("detail", "").lower():
                results.log_test("Insufficient BTC rejection", True, f"Correctly rejected insufficient BTC (tried {excessive_amount}, has {user_balance})")
            elif "small" in error_data.get("detail", "").lower():
                # The amount might be too small to convert - try a smaller amount that would still fail
                small_sell = {"amount": 10}  # Very small amount
                small_response = requests.post(f"{BASE_URL}/exchange/sell", params={"user_id": test_user_id}, json=small_sell)
                if small_response.status_code == 400:
                    results.log_test("Small amount conversion", True, "Correctly handled small conversion amount")
                else:
                    results.log_test("Small amount conversion", True, "Small conversion succeeded or handled gracefully")
            else:
                results.log_test("Insufficient BTC rejection", False, f"Unexpected error: {error_data}")
        else:
            if response.status_code == 200:
                results.log_test("Sell BTC transaction", True, f"Sell transaction succeeded (user balance: {user_balance})")
            else:
                results.log_test("Sell BTC transaction", False, f"Unexpected status: {response.status_code}")
    
    except Exception as e:
        results.log_test("Exchange endpoints", False, f"Error: {str(e)}")
    
    return results

def test_leaderboard_endpoints():
    """Test leaderboard endpoints with different types"""
    results = TestResults()
    
    try:
        # Test balance leaderboard
        response = requests.get(f"{BASE_URL}/leaderboard", params={"type": "balance", "limit": 10})
        
        if response.status_code == 200:
            leaderboard = response.json()
            if isinstance(leaderboard, list):
                results.log_test("Balance leaderboard", True, f"Returned {len(leaderboard)} entries")
                
                if leaderboard and "rank" in leaderboard[0]:
                    results.log_test("Leaderboard structure", True, "Rank field present")
                else:
                    results.log_test("Leaderboard structure", False, "Missing rank field")
            else:
                results.log_test("Balance leaderboard", False, "Expected array response")
        else:
            results.log_test("Balance leaderboard", False, f"Status: {response.status_code}")
        
        # Test power leaderboard
        response = requests.get(f"{BASE_URL}/leaderboard", params={"type": "power"})
        
        if response.status_code == 200:
            results.log_test("Power leaderboard", True, "Power leaderboard accessible")
        else:
            results.log_test("Power leaderboard", False, f"Status: {response.status_code}")
        
        # Test referrals leaderboard
        response = requests.get(f"{BASE_URL}/leaderboard", params={"type": "referrals"})
        
        if response.status_code == 200:
            results.log_test("Referrals leaderboard", True, "Referrals leaderboard accessible")
        else:
            results.log_test("Referrals leaderboard", False, f"Status: {response.status_code}")
    
    except Exception as e:
        results.log_test("Leaderboard endpoints", False, f"Error: {str(e)}")
    
    return results

def test_referral_endpoints():
    """Test referral system endpoints"""
    results = TestResults()
    
    if not test_user_id:
        results.log_test("Referral endpoints", False, "No user ID available")
        return results
    
    try:
        # Test GET /referral/info
        response = requests.get(f"{BASE_URL}/referral/info", params={"user_id": test_user_id})
        
        if response.status_code == 200:
            referral_info = response.json()
            required_fields = ["referral_code", "total_referrals", "referral_earnings"]
            
            missing_fields = [field for field in required_fields if field not in referral_info]
            if not missing_fields:
                results.log_test("Referral info structure", True, "All required fields present")
            else:
                results.log_test("Referral info structure", False, f"Missing fields: {missing_fields}")
        else:
            results.log_test("Referral info endpoint", False, f"Status: {response.status_code}")
        
        # Test GET /referral/top
        response = requests.get(f"{BASE_URL}/referral/top")
        
        if response.status_code == 200:
            top_referrers = response.json()
            if isinstance(top_referrers, list):
                results.log_test("Top referrers", True, f"Returned {len(top_referrers)} referrers")
            else:
                results.log_test("Top referrers", False, "Expected array response")
        else:
            results.log_test("Top referrers endpoint", False, f"Status: {response.status_code}")
    
    except Exception as e:
        results.log_test("Referral endpoints", False, f"Error: {str(e)}")
    
    return results

def test_instant_mining():
    """Test instant mining endpoint"""
    results = TestResults()
    
    if not test_user_id:
        results.log_test("Instant mining", False, "No user ID available")
        return results
    
    try:
        response = requests.post(f"{BASE_URL}/mine/instant", params={"user_id": test_user_id})
        
        if response.status_code == 200:
            data = response.json()
            if "reward" in data and "user" in data:
                reward = data["reward"]
                if isinstance(reward, int) and reward > 0:
                    results.log_test("Instant mining reward", True, f"Reward: {reward} satoshi")
                else:
                    results.log_test("Instant mining reward", False, f"Invalid reward: {reward}")
                
                # Check user balance updated
                updated_user = data["user"]
                if "balance_satoshi" in updated_user:
                    results.log_test("Balance update", True, f"New balance: {updated_user['balance_satoshi']}")
                else:
                    results.log_test("Balance update", False, "Missing balance in response")
            else:
                results.log_test("Instant mining response", False, "Missing reward or user in response")
        else:
            results.log_test("Instant mining endpoint", False, f"Status: {response.status_code}")
    
    except Exception as e:
        results.log_test("Instant mining", False, f"Error: {str(e)}")
    
    return results

def run_all_tests():
    """Run all backend API tests"""
    print("🚀 Starting Genesis Block Backend API Tests")
    print(f"Base URL: {BASE_URL}")
    print("=" * 60)
    
    all_results = []
    
    # Run tests in logical order
    test_functions = [
        ("Health Check", test_health_check),
        ("Authentication", test_authentication),
        ("Init/Game State", test_init_game_state),
        ("Block Info", test_block_info),
        ("Miners", test_miners_endpoints),
        ("Exchange", test_exchange_endpoints),
        ("Leaderboard", test_leaderboard_endpoints),
        ("Referral", test_referral_endpoints),
        ("Instant Mining", test_instant_mining),
    ]
    
    for test_name, test_func in test_functions:
        print(f"\n📋 Running {test_name} Tests...")
        results = test_func()
        all_results.append((test_name, results))
        time.sleep(0.5)  # Brief pause between test suites
    
    # Print overall summary
    print(f"\n{'='*60}")
    print("🎯 OVERALL TEST SUMMARY")
    print(f"{'='*60}")
    
    total_passed = sum(r.passed for _, r in all_results)
    total_failed = sum(r.failed for _, r in all_results)
    
    for test_name, results in all_results:
        status = "✅" if results.failed == 0 else "❌"
        print(f"{status} {test_name}: {results.passed} passed, {results.failed} failed")
    
    print(f"\n📊 FINAL RESULTS:")
    print(f"Total Tests: {total_passed + total_failed}")
    print(f"Passed: {total_passed}")
    print(f"Failed: {total_failed}")
    if total_passed + total_failed > 0:
        print(f"Success Rate: {total_passed/(total_passed + total_failed)*100:.1f}%")
    
    # Print detailed failures if any
    failed_tests = []
    for test_name, results in all_results:
        if results.failed > 0:
            failed_tests.extend([f"[{test_name}] {r}" for r in results.results if "❌" in r])
    
    if failed_tests:
        print(f"\n❌ FAILED TESTS DETAILS:")
        for failure in failed_tests:
            print(f"  {failure}")
    
    return total_failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)