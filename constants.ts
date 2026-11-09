import { Plane, Car, Award, Clock, MapPin, ShieldCheck, Phone } from 'lucide-react';
import { Service, Testimonial, Feature, NavigationItem, Zone, RouteRow } from './types';

export const PHONE_NUMBER = "+961 3 301 019";
export const PHONE_NUMBER_CLEAN = "9613301019";
export const SECONDARY_PHONE_NUMBER = "+961 76 301019";
export const SECONDARY_PHONE_NUMBER_CLEAN = "96176301019";
export const WHATSAPP_MESSAGE = "Hello Andrew's Taxi, I would like to book a ride.";
export const WHATSAPP_LINK = `https://wa.me/${PHONE_NUMBER_CLEAN}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
export const SECONDARY_WHATSAPP_LINK = `https://wa.me/${SECONDARY_PHONE_NUMBER_CLEAN}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
export const EMAIL = "andrewstaxilb@gmail.com";
export const GOOGLE_MAPS_LINK = "https://www.google.com/maps/search/?api=1&query=XJMP%2BW36+Jounieh";
export const GOOGLE_REVIEWS_LINK = "https://share.google/1JkyUvwWTwvJ72SxR"; // Using the provided share link
export const FACEBOOK_LINK = "https://www.facebook.com/andrwesTaxi/";
export const INSTAGRAM_LINK = "https://www.instagram.com/andrewtaxi6/";

// ─────────────────────────────────────────────────────────────────────────────
//  AREAS
//
//  These are the pickup and drop-off areas the customer picks from.
//  To add an area: copy a line, give it a NEW id, a label, and a group.
//  The group is just the heading it appears under in the dropdown.
// ─────────────────────────────────────────────────────────────────────────────
export const OTHER_ZONE_ID = 'other';

export const ZONES: Zone[] = [
  { id: 'bey-airport', label: 'Beirut Airport (BEY)', group: 'Beirut' },
  { id: 'beirut-central', label: 'Beirut – Downtown / Achrafieh', group: 'Beirut' },
  { id: 'beirut-west', label: 'Beirut – Hamra / Verdun / Ras Beirut', group: 'Beirut' },
  { id: 'beirut-south', label: 'Beirut – Chiyah / Ouzai / Bourj Brajneh', group: 'Beirut' },
  { id: 'beirut-suburbs', label: 'Hazmieh / Baabda / Dekwaneh / Jdeideh', group: 'Beirut' },
  { id: 'jounieh', label: 'Jounieh / Kaslik / Zouk', group: 'Mount Lebanon' },
  { id: 'faraya', label: 'Faraya / Kfardebian', group: 'Mount Lebanon' },
  { id: 'byblos', label: 'Byblos (Jbeil)', group: 'North Coast' },
  { id: 'batroun', label: 'Batroun', group: 'North Coast' },
  { id: 'tripoli', label: 'Tripoli', group: 'North Coast' },
  { id: 'zahle', label: 'Zahle', group: 'Bekaa' },
  { id: 'baalbek', label: 'Baalbek', group: 'Bekaa' },
  { id: 'saida', label: 'Saida (Sidon)', group: 'South' },
  { id: 'tyre', label: 'Tyre (Sour)', group: 'South' },
  { id: OTHER_ZONE_ID, label: 'Other / not listed', group: 'Other' },
];

export const FARE_RULES = {
  CURRENCY_SYMBOL: '$',
  MIN_FARE_USD: 6,           // no ride is quoted below this
  ROUND_TRIP_MULTIPLIER: 2,  // return trip = one-way x 2 unless a roundTrip price is given
  FREE_WAIT_MINUTES: 50,
  MAX_WAIT_HOURS: 4,

  // Leave this false while the prices below are still being agreed.
  // false -> the website says "Indicative Price"
  // true  -> the website says "Fixed Price"
  PRICES_CONFIRMED: false,
};

// ─────────────────────────────────────────────────────────────────────────────
//  PRICE LIST — HOW TO EDIT (no coding knowledge needed)
//
//  1. Each line below is ONE route and its price in US dollars.
//  2. Direction does not matter. Airport -> Jounieh is the same price as
//     Jounieh -> Airport. Write each route only ONCE.
//  3. To change a price, edit the number after   oneWay:
//  4. roundTrip: is optional. Leave it out and the return price is
//     automatically the one-way price x 2. Add   roundTrip: 60,   to
//     charge something different.
//  5. To add a route, copy any line and change from / to / oneWay.
//     The from and to values MUST match an   id:   in ZONES above.
//  6. Any route NOT listed here shows "Price on request" and sends the
//     customer to WhatsApp with their trip details already filled in.
//     Nothing breaks — you just quote that one by hand.
//
//  THE LIST IS EMPTY ON PURPOSE. Until Andrew confirms his prices, every
//  route quotes on request. Add a line and that price goes live immediately.
//
//  Example (delete the // to switch it on):
//  { from: 'bey-airport', to: 'jounieh', oneWay: 35 },
// ─────────────────────────────────────────────────────────────────────────────
export const ROUTE_PRICES: RouteRow[] = [
];

export const NAV_ITEMS: NavigationItem[] = [
  { label: 'Services', href: '/#services' },
  { label: 'Estimate Fare', href: '/#fare-estimator' },
  { label: 'Why Us', href: '/#features' },
  { label: 'How it Works', href: '/#how-it-works' },
  { label: 'Reviews', href: '/#testimonials' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/#contact' },
];

export const SERVICES: Service[] = [
  {
    id: 'airport',
    title: 'Airport Transfers',
    description: 'Reliable pickups and drop-offs at Beirut-Rafic Hariri International Airport. We track your flight to ensure we are there when you land.',
    icon: Plane,
  },
  {
    id: 'city',
    title: 'City Rides',
    description: 'Quick and comfortable rides anywhere in Lebanon. Perfect for daily commutes, shopping trips, or visiting friends.',
    icon: Car,
  },
  {
    id: 'professional',
    title: 'Professional Service',
    description: 'Experienced drivers for business meetings, full-day bookings, or special events. Enjoy a smooth, safe, and high-quality journey.',
    icon: Award,
  },
];

export const FEATURES: Feature[] = [
  {
    id: '247',
    title: 'Available 24/7',
    description: 'Early morning flight? Late night party? We are available around the clock to get you where you need to be.',
    icon: Clock,
  },
  {
    id: 'pricing',
    title: 'Fixed Pricing',
    description: 'No surprises or hidden fees. We offer competitive, fixed rates so you know exactly what you pay before you ride.',
    icon: ShieldCheck,
  },
  {
    id: 'drivers',
    title: 'Professional Drivers',
    description: 'Our drivers are experienced, polite, and know the quickest routes across Lebanon to save you time.',
    icon: MapPin,
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Sarah Miller',
    location: 'Airport Transfer',
    content: 'The best taxi experience I have had in Lebanon. Andrew was waiting for me at arrivals with a sign, helped with my heavy bags, and the car was very clean. Highly recommended!',
    stars: 5,
    date: '2 weeks ago',
    initial: 'S'
  },
  {
    id: '2',
    name: 'Karim Hage',
    location: 'Beirut',
    content: 'Very professional service. I booked a ride from Jounieh to the Airport at 3 AM. The driver was 10 minutes early and the drive was smooth. Fair prices too.',
    stars: 5,
    date: '1 month ago',
    initial: 'K'
  },
  {
    id: '3',
    name: 'Elena Costa',
    location: 'Tourist',
    content: 'We used Andrew\'s Taxi for a full day trip to Byblos and Batroun. The driver was so polite and drove very safely. Felt completely at ease. Thank you!',
    stars: 5,
    date: '3 weeks ago',
    initial: 'E'
  },
  {
    id: '4',
    name: 'Jad Khoury',
    location: 'Local Guide',
    content: 'Honest pricing and clean cars. It is hard to find reliable taxis in Beirut sometimes, but these guys are consistent. Booked via WhatsApp in seconds.',
    stars: 5,
    date: '2 months ago',
    initial: 'J'
  },
  {
    id: '5',
    name: 'Mike Peterson',
    location: 'Business Traveler',
    content: 'Professional driver. AC was working perfectly (vital in summer). Smooth ride to my meeting in Downtown. Will use again next time I visit.',
    stars: 5,
    date: '1 week ago',
    initial: 'M'
  },
  {
    id: '6',
    name: 'Nour S.',
    location: 'Regular Client',
    content: 'My go-to taxi service. I feel safe riding alone at night with them. The drivers are respectful and professional.',
    stars: 5,
    date: '3 days ago',
    initial: 'N'
  },
];