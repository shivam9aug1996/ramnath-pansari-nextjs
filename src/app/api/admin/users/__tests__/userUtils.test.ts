import assert from "node:assert/strict";

import {
  GUEST_MOBILE,
  buildUserListFilter,
  resolveIsGuest,
} from "../userUtils";

assert.equal(resolveIsGuest({ mobileNumber: GUEST_MOBILE }), true);
assert.equal(resolveIsGuest({ isGuestUser: true }), true);
assert.equal(resolveIsGuest({ mobileNumber: "9876543210" }), false);

assert.deepEqual(buildUserListFilter("guest"), {
  $or: [{ mobileNumber: GUEST_MOBILE }, { isGuestUser: true }],
});

assert.deepEqual(
  (buildUserListFilter("customer") as { isGuestUser: { $ne: boolean } })
    .isGuestUser,
  { $ne: true },
);

console.log("userUtils guest filters ok");
