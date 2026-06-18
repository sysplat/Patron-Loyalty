import assert from 'assert';
import {
  getServeSurfaceStorageKey,
  readServeSurfaceStorageKey,
  readPersistedServeBranchId,
  persistServeBranchId,
} from '../apps/web/src/lib/serve-surface-routing';

// Setup Mock window & localStorage
const mockStore: Record<string, string> = {};

// Cast to any to allow overriding global window & localStorage in Node environment
(global as any).window = {};
(global as any).localStorage = {
  getItem(key: string) {
    return mockStore[key] !== undefined ? mockStore[key] : null;
  },
  setItem(key: string, value: any) {
    mockStore[key] = String(value);
  },
  removeItem(key: string) {
    delete mockStore[key];
  },
  clear() {
    for (const k in mockStore) {
      delete mockStore[k];
    }
  },
};

function runTests() {
  console.log('🚀 Testing: serve-surface-routing LocalStorage Namespacing (TS)');
  console.log('-------------------------------------------------------------');

  // Test 1: getServeSurfaceStorageKey
  console.log('[1/5] Testing key formatting...');
  const key1 = getServeSurfaceStorageKey('desk_number', 'user-123');
  assert.strictEqual(key1, 'desk_number:user-123', 'Key should be formatted as baseKey:userId');
  console.log('  ✓ getServeSurfaceStorageKey formats correctly.');

  // Test 2: readServeSurfaceStorageKey (Empty State)
  console.log('[2/5] Testing read with empty store...');
  localStorage.clear();
  const val1 = readServeSurfaceStorageKey('desk_number', 'user-123');
  assert.strictEqual(val1, null, 'Should return null if no key exists');
  console.log('  ✓ Returns null when no key exists.');

  // Test 3: readServeSurfaceStorageKey (Scoped Key Exists)
  console.log('[3/5] Testing read with scoped key already present...');
  localStorage.clear();
  localStorage.setItem('desk_number:user-123', '4');
  const val2 = readServeSurfaceStorageKey('desk_number', 'user-123');
  assert.strictEqual(val2, '4', 'Should return the scoped key value');
  console.log('  ✓ Returns scoped key when it is present.');

  // Test 4: readServeSurfaceStorageKey (One-time Migration from Legacy)
  console.log('[4/5] Testing one-time legacy key migration...');
  localStorage.clear();
  localStorage.setItem('desk_number', '7'); // Set legacy key

  const val3 = readServeSurfaceStorageKey('desk_number', 'user-123');

  // Check returned value is migrated value
  assert.strictEqual(val3, '7', 'Should return the legacy key value during migration');

  // Check that scoped key now has the value
  const scopedVal = localStorage.getItem('desk_number:user-123');
  assert.strictEqual(scopedVal, '7', 'Should have written legacy value to scoped key');

  // Check that legacy key was deleted
  const legacyVal = localStorage.getItem('desk_number');
  assert.strictEqual(legacyVal, null, 'Should delete legacy key after migration');
  console.log('  ✓ Successfully migrates legacy anonymous key to user-scoped key and cleans up.');

  // Test 5: persistServeBranchId (With and without Scoped User ID)
  console.log('[5/5] Testing branch ID persistence...');
  localStorage.clear();

  // Without User ID (Anonymous/Legacy)
  persistServeBranchId('branch-abc');
  assert.strictEqual(localStorage.getItem('agent_selected_branch'), 'branch-abc');
  assert.strictEqual(localStorage.getItem('journey_selected_branch'), 'branch-abc');
  assert.strictEqual(localStorage.getItem('workbench_selected_branch'), 'branch-abc');

  // With User ID (Scoped)
  localStorage.clear();
  persistServeBranchId('branch-xyz', 'user-123');
  assert.strictEqual(localStorage.getItem('agent_selected_branch:user-123'), 'branch-xyz');
  assert.strictEqual(localStorage.getItem('journey_selected_branch:user-123'), 'branch-xyz');
  assert.strictEqual(localStorage.getItem('workbench_selected_branch:user-123'), 'branch-xyz');
  // Verify it did not write legacy keys
  assert.strictEqual(localStorage.getItem('agent_selected_branch'), null);

  console.log('  ✓ Persists branch ID correctly across scoped keys.');

  // Test 6: Logged-in work routing ignores another user's legacy branch keys
  console.log(
    '[6/8] Testing readPersistedServeBranchId ignores unscoped legacy for logged-in user...',
  );
  localStorage.clear();
  localStorage.setItem('agent_selected_branch', 'branch-from-other-user');
  const isolated = readPersistedServeBranchId('user-b');
  assert.strictEqual(isolated, null, 'Must not inherit unscoped legacy branch');
  assert.strictEqual(localStorage.getItem('agent_selected_branch'), 'branch-from-other-user');
  console.log('  ✓ Logged-in user does not read cross-user legacy branch keys.');

  // Test 7: Logged-in user reads scoped branch
  console.log('[7/8] Testing readPersistedServeBranchId returns user-scoped branch...');
  localStorage.clear();
  persistServeBranchId('branch-b', 'user-b');
  assert.strictEqual(readPersistedServeBranchId('user-b'), 'branch-b');
  console.log('  ✓ Returns scoped branch for the active user.');

  // Test 8: Anonymous / pre-auth still reads legacy keys
  console.log('[8/8] Testing readPersistedServeBranchId without userId reads legacy...');
  localStorage.clear();
  localStorage.setItem('journey_selected_branch', 'branch-legacy');
  assert.strictEqual(readPersistedServeBranchId(), 'branch-legacy');
  console.log('  ✓ Legacy keys still work when no user id is provided.');

  console.log('\n🎉 All LocalStorage Namespacing unit tests passed successfully!');
}

try {
  runTests();
} catch (error) {
  console.error('\n❌ TEST FAILED');
  console.error(error);
  process.exit(1);
}
