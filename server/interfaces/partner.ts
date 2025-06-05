export interface Partner {
  id: number;
  userId: number;
  businessName: string;
  businessType: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  description?: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  zipcode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  logo?: string;
  profileImage?: string;
  website?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPartner = Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>;

export interface PartnerService {
  id: number;
  partnerId: number;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  status: 'active' | 'inactive';
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPartnerService = Omit<PartnerService, 'id' | 'createdAt' | 'updatedAt'>;

export interface PartnerReview {
  id: number;
  partnerId: number;
  userId: number;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertPartnerReview = Omit<PartnerReview, 'id' | 'createdAt' | 'updatedAt'>; 