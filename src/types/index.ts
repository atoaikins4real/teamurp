export interface Vendor {
  id: number;
  name: string;
  type: 'Transport' | 'Accommodation' | 'Guide';
  lat: number;
  lng: number;
  status: 'Available' | 'Busy';
}