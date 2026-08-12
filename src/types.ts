export interface ProviderMessage {
  message_id: string;
  in_reply_to?: string;
  references?: string[];
  subject: string;
  from: string;
  to: string[];
  sent_at: string;
}

export interface MessagesPage {
  items: ProviderMessage[];
  next_cursor: string | null;
}
