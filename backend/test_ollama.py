import urllib.request, urllib.error, json

code_text = """
#include <stdio.h>
#include <stdlib.h>

/**
 * Note: The returned array must be malloced, assume caller calls free().
 */

// Helper to count even numbers in nums[l...r] that are <= val
long long countRemoved(int* nums, int* pref, int l, int r, long long val) {
    if (val < (long long)nums[l]) return 0;
    int low = l, high = r;
    int idx = -1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if ((long long)nums[mid] <= val) {
            idx = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return (idx == -1) ? 0 : (long long)(pref[idx + 1] - pref[l]);
}

// Changed return type to int* to match the LeetCode test runner expectations
int* kthRemainingInteger(int* nums, int numsSize, int** queries, int queriesSize, int* queriesColSize, int* returnSize) {
    *returnSize = queriesSize;
    int* ans = (int*)malloc(queriesSize * sizeof(int));
    
    // 1. Prefix sum of even number counts
    int* pref = (int*)malloc((numsSize + 1) * sizeof(int));
    pref[0] = 0;
    for (int i = 0; i < numsSize; i++) {
        pref[i + 1] = pref[i] + (nums[i] % 2 == 0 ? 1 : 0);
    }

    for (int i = 0; i < queriesSize; i++) {
        int l = queries[i][0];
        int r = queries[i][1];
        long long k = (long long)queries[i][2];
        
        // 2. Binary search for the kth even number
        long long low = 1, high = 2100000000LL; 
        long long res = 2;
        
        while (low <= high) {
            long long mid = low + (high - low) / 2;
            long long totalEvens = mid / 2;
            long long removed = countRemoved(nums, pref, l, r, mid);
            
            if (totalEvens - removed >= k) {
                res = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        
        // Ensure it lands on an even number
        if (res % 2 != 0) res++;
        
        // Final boundary check
        long long currentAvailable = (res / 2) - countRemoved(nums, pref, l, r, res);
        if (currentAvailable < k) res += 2;
        
        ans[i] = (int)res;
    }

    free(pref);
    return ans;
}
"""

prompt = f"""You are an expert AI detection system for competitive programming.
Analyze the following LeetCode submission and determine if it was written by an AI (like ChatGPT) or a human.
Respond ONLY with a valid JSON object containing exactly two keys:
1. "score": an integer from 0 to 100 representing the likelihood it is AI generated.
2. "reasons": a list of string reasons explaining the score (keep them brief).

Code:
```
{code_text}
```
"""
req = urllib.request.Request("http://localhost:11434/api/generate", data=json.dumps({
    "model": "qwen2.5-coder:1.5b",
    "prompt": prompt,
    "stream": False,
    "format": "json"
}).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.loads(response.read().decode())
        response_text = result.get("response", "{}")
        print(json.loads(response_text))
except Exception as e:
    print(e)
