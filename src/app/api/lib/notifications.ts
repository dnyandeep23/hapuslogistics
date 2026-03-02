import Notification from "@/app/api/models/notificationModel";

export const createNotification = async (payload: {
  recipientUserId: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) => {
  try {
    await Notification.create({
      recipientUserId: payload.recipientUserId,
      title: payload.title,
      message: payload.message,
      type: payload.type ?? "info",
      metadata: payload.metadata ?? {},
    });
  } catch {
    // Non-blocking notification write
  }
};
