import Bus from "@/app/api/models/busModel";
import Notification from "@/app/api/models/notificationModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import User from "@/app/api/models/userModel";

export const ACCOUNT_DELETION_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

type DeletableUser = {
  _id: { toString(): string };
  email?: string;
  role?: string;
  accountDeletionRequestedAt?: Date | null;
  accountDeletionExpiresAt?: Date | null;
  save: () => Promise<unknown>;
};

export const getAccountDeletionExpiryDate = () =>
  new Date(Date.now() + ACCOUNT_DELETION_GRACE_MS);

export const hasScheduledAccountDeletion = (
  user: Pick<DeletableUser, "accountDeletionRequestedAt" | "accountDeletionExpiresAt"> | null | undefined,
) => Boolean(user?.accountDeletionRequestedAt || user?.accountDeletionExpiresAt);

export const isAccountDeletionExpired = (
  user: Pick<DeletableUser, "accountDeletionExpiresAt"> | null | undefined,
) => {
  if (!user?.accountDeletionExpiresAt) return false;
  return new Date(user.accountDeletionExpiresAt).getTime() <= Date.now();
};

export const scheduleAccountDeletion = async (user: DeletableUser) => {
  const requestedAt = new Date();
  const expiresAt = getAccountDeletionExpiryDate();

  user.accountDeletionRequestedAt = requestedAt;
  user.accountDeletionExpiresAt = expiresAt;
  await user.save();

  return {
    requestedAt,
    expiresAt,
  };
};

export const clearScheduledAccountDeletion = async (user: DeletableUser) => {
  if (!hasScheduledAccountDeletion(user)) {
    return false;
  }

  user.accountDeletionRequestedAt = undefined;
  user.accountDeletionExpiresAt = undefined;
  await user.save();
  return true;
};

export const permanentlyDeleteUserAccount = async (
  userOrId: string | (DeletableUser & { role?: string; email?: string }),
) => {
  const user =
    typeof userOrId === "string"
      ? await User.findById(userOrId)
      : userOrId;

  if (!user?._id) {
    return false;
  }

  await Bus.updateMany(
    {},
    { $pull: { operatorContactPeriods: { operatorId: user._id } } },
  );

  await Notification.deleteMany({ recipientUserId: user._id });

  if (user.role === "admin") {
    await TravelCompany.updateMany(
      {
        $or: [
          { ownerUserId: user._id },
          user.email
            ? { ownerEmail: String(user.email).trim().toLowerCase() }
            : { _id: null },
        ],
      },
      {
        $unset: {
          ownerUserId: 1,
          ownerEmail: 1,
        },
      },
    );
  }

  await User.deleteOne({ _id: user._id });
  return true;
};

export const cleanupExpiredUserAccounts = async () => {
  const expiredUsers = await User.find({
    accountDeletionExpiresAt: { $lte: new Date() },
  }).select("_id email role");

  let deletedCount = 0;

  for (const user of expiredUsers) {
    const deleted = await permanentlyDeleteUserAccount(user);
    if (deleted) {
      deletedCount += 1;
    }
  }

  return deletedCount;
};
