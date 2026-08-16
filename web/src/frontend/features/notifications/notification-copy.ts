import type {
  NotificationItem,
  NotificationSeverity,
} from "@/shared/contracts/notifications";

export function recruiterNotificationDestination(
  notification: NotificationItem,
): string | null {
  if (
    notification.contextType !== "JOB_POST_REVIEW" ||
    !notification.contextId ||
    !["JOB_POST_APPROVED", "JOB_POST_REJECTED"].includes(notification.kind)
  )
    return notification.href;
  return `/recruiter/job-postings?review=${encodeURIComponent(notification.contextId)}`;
}

export const notificationCopy = {
  vi: {
    label: "Thông báo",
    title: "Trung tâm thông báo",
    markAll: "Đánh dấu tất cả đã đọc",
    viewAll: "Xem tất cả thông báo",
    empty: "Bạn chưa có thông báo nào.",
    error: "Không thể tải thông báo. Hãy thử lại.",
    retry: "Thử lại",
    loadMore: "Tải thêm",
    unread: "Chưa đọc",
    read: "Đã đọc",
    loading: "Đang tải thông báo…",
    severities: {
      CRITICAL: "Nghiêm trọng",
      HIGH: "Quan trọng",
      MEDIUM: "Cập nhật",
      LOW: "Thông tin",
    } satisfies Record<NotificationSeverity, string>,
  },
  en: {
    label: "Notifications",
    title: "Notification center",
    markAll: "Mark all as read",
    viewAll: "View all notifications",
    empty: "You have no notifications yet.",
    error: "Notifications could not be loaded. Try again.",
    retry: "Try again",
    loadMore: "Load more",
    unread: "Unread",
    read: "Read",
    loading: "Loading notifications…",
    severities: {
      CRITICAL: "Critical",
      HIGH: "Important",
      MEDIUM: "Update",
      LOW: "Information",
    } satisfies Record<NotificationSeverity, string>,
  },
} as const;

export const notificationTime = (value: string, locale: "vi" | "en") =>
  new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
