export interface AvailableOffer {
  id: string;
  code: string;
  discount_percentage: number;
  description: string;
}

export interface WebNotice {
  title: string;
  message: string;
  onClose?: () => void;
}
