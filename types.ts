import { LucideIcon } from 'lucide-react';

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  content: string;
  stars: number;
  date: string;
  initial: string;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface NavigationItem {
  label: string;
  href: string;
}

// --- FARE / ROUTE PRICING ---

export type ZoneId = string;
export type TripType = 'one-way' | 'round-trip';

/** A pickup or drop-off area the customer can choose from. */
export interface Zone {
  id: ZoneId;
  label: string;    // exactly what the customer sees in the dropdown
  group: string;    // heading the option is listed under
}

/** One row of the price list. Direction does not matter. */
export interface RouteRow {
  from: ZoneId;
  to: ZoneId;
  oneWay: number;        // USD
  roundTrip?: number;    // optional override; defaults to oneWay * ROUND_TRIP_MULTIPLIER
}

export type FareQuote =
  | { status: 'fixed'; price: number; tripType: TripType }
  | { status: 'on-request'; reason: 'incomplete' | 'other-zone' | 'unlisted-pair' };

export interface LocationPoint {
  title: string;
  lat: number;
  lng: number;
}

export interface CarTypeOption {
  id: string;
  label: string;
  capacity: string;
}
