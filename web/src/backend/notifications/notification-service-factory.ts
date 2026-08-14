import "server-only";
import { NotificationService } from "./notification-service";

export const createNotificationService = () => new NotificationService();
