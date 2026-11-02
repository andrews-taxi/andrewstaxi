#!/usr/bin/env node
/**
 * scripts/generate-blog.js
 *
 * Daily SEO post generator for Andrews Taxi.
 * Dynamically selects high-intent Google search taxi topics,
 * prevents repetitive themes through historical deduplication,
 * and incorporates high-ranking search keywords and trending hashtags.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';

const POSTS_DIR = path.join(process.cwd(), 'blog');
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
const CONSTANTS_FILE = path.join(process.cwd(), 'constants.ts');

const SITE_URL = 'https://www.andrewstaxi.com';

const MODEL = 'claude-sonnet-5-5';
const DRAFT_MODE = String(process.env.DRAFT_MODE).toLowerCase() === 'true';

const MAX_SEARCHES = 6;
const MAX_ROUNDS = 10;

function fail(message) {
  console.error(`\n[generate-blog] ERROR: ${message}\n`);
  process.exit(1);
}

function log(message) {
  console.log(`[generate-blog] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// Read Constants.ts to inject real zones/services
function loadCatalogue() {
  if (!fs.existsSync(CONSTANTS_FILE)) return [];
  const source = fs.readFileSync(CONSTANTS_FILE, 'utf8');
  const zones = [];
  const matches = source.matchAll(/id:\s*'([^']+)',\s*label:\s*'([^']+)'/g);
  for (const match of matches) {
    if (match[1] !== 'other') {
      zones.push({ id: match[1], title: match[2], url: `${SITE_URL}/#fare-estimator` });
    }
  }
  return zones;
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-INTENT GOOGLE SEARCH TAXI PILLARS
// Mapped to actual queries people type when looking for a taxi in Lebanon
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_PILLARS = [
  {
    id: 'taxi_near_me_247',
    name: 'Taxi Near Me & 24/7 Urgent Dispatch',
    intent: 'Immediate on-demand pickup across Greater Beirut and Mount Lebanon, 24/7 emergency rides, rainy weather transport, fast WhatsApp booking.',
    matchTerms: ['near me', 'emergency', '24/7', 'fast pickup', 'call taxi', 'urgent', 'dispatch'],
    primaryKeywords: [
      'taxi near me Beirut',
      'call taxi Lebanon',
      '24/7 taxi Lebanon',
      'taxi number Achrafieh',
      'fast cab pickup Hamra',
      'emergency taxi ride Beirut',
      'taxi service near me Lebanon',
      'book taxi WhatsApp Lebanon'
    ],
    secondaryKeywords: [
      'night taxi Beirut',
      'cab service Beirut',
      'taxi Metn',
      'taxi Keserwan',
      'reliable taxi phone number Lebanon'
    ],
    hashtags: [
      '#TaxiNearMe',
      '#BeirutTaxi',
      '#LebanonTaxi',
      '#TaxiLebanon',
      '#247Taxi',
      '#CallTaxiBeirut',
      '#FastCabLebanon',
      '#BeirutTransport',
      '#AndrewsTaxi'
    ],
    angles: [
      'Stuck in Beirut? How to get a fast, reliable taxi near you in minutes with transparent fixed pricing',
      'Why keeping a reliable 24/7 taxi WhatsApp number saved in your phone is essential in Lebanon',
      'Late-night emergencies and bad weather commutes: How our on-call drivers keep Greater Beirut moving'
    ],
    suggestedSearch: 'taxi near me Beirut 24/7 service on demand',
    visualTheme: 'A modern yellow taxi waiting curbside on a vibrant Beirut avenue like Sassine Square Achrafieh or Hamra at dusk, streetlamps glowing, photorealistic urban photography'
  },
  {
    id: 'airport_transfers_bey',
    name: 'Beirut Airport (BEY) Transfers & Flight Arrivals',
    intent: 'Travelers landing at Rafic Hariri International Airport looking for dependable transfers, meet-and-greet service, luggage assistance, and transparent pricing without curb scams.',
    matchTerms: ['airport taxi', 'airport transfer', 'rafic hariri', 'bey airport', 'arrivals', 'flight delay'],
    primaryKeywords: [
      'Beirut airport taxi',
      'Beirut airport taxi booking',
      'Beirut airport transfer fixed price',
      'flight delay taxi pickup Beirut',
      'meet and greet Beirut airport',
      'taxi Beirut airport to Hamra Achrafieh',
      'airport taxi luggage van Beirut'
    ],
    secondaryKeywords: [
      'BEY airport transfer',
      'Rafic Hariri taxi',
      'Beirut airport to Jounieh taxi fare',
      'avoid airport taxi scams Beirut'
    ],
    hashtags: [
      '#BeirutAirport',
      '#BeirutAirportTaxi',
      '#AirportTransferLebanon',
      '#BEYairport',
      '#LebanonTravel',
      '#BeirutTrip',
      '#LebanonDiaspora',
      '#AndrewsTaxi'
    ],
    angles: [
      'Arriving at Beirut Airport: How meet-and-greet taxi booking protects you from overcharging and hassle',
      'Flying into Lebanon with heavy luggage: Why pre-booking a spacious airport van taxi makes sense',
      'Flight delayed? How our Beirut Airport transfer service tracks real-time flight arrivals so your driver is always there'
    ],
    suggestedSearch: 'Beirut airport taxi arrivals terminal travel guide',
    visualTheme: 'Commercial photography of a pristine modern white luxury sedan taxi with a sleek taxi roof light, parked smoothly on a clean sunlit roadway, shallow depth of field. Clean solid paint with ABSOLUTELY NO NUMBERS, NO PHONE NUMBERS, NO DECALS, NO TEXT, and a blank clean license plate. Elegant automotive lighting, photorealistic, 8k resolution.'
  },

  {
    id: 'nightlife_and_safe_rides',
    name: 'Beirut Nightlife, Mar Mikhael Bars & Safe Ride Home',
    intent: 'Partygoers, diners, and tourists visiting Beirut nightlife hubs (Mar Mikhael, Gemmayze, Badaro, Waterfront) looking for safe, reliable rides home with zero DUI risk and no parking hassle.',
    matchTerms: ['nightlife', 'mar mikhael', 'gemmayze', 'badaro', 'safe night', 'clubbing', 'bar street'],
    primaryKeywords: [
      'safe night taxi Beirut',
      'Mar Mikhael nightlife taxi',
      'Badaro bar taxi pickup',
      'Gemmayze taxi pickup',
      'Beirut clubbing transport',
      'designated driver Lebanon',
      'late night ride home Beirut',
      'safe taxi Beirut nightlife'
    ],
    secondaryKeywords: [
      'weekend taxi Beirut',
      'party transfer Lebanon',
      'Beirut by night taxi',
      'Monnot bar taxi'
    ],
    hashtags: [
      '#BeirutNightlife',
      '#MarMikhael',
      '#Gemmayze',
      '#Badaro',
      '#BeirutBars',
      '#SafeRideBeirut',
      '#BeirutByNight',
      '#LebanonNightlife',
      '#AndrewsTaxi'
    ],
    angles: [
      'Night out in Mar Mikhael and Gemmayze: Why booking a safe taxi beats valet parking and late-night driving stress',
      'Zero DUI, 100% Fun: How to plan your Beirut weekend bar-hopping with a dedicated on-call driver',
      'Badaro nightlife guide: Enjoying Beirut craft pubs and bistros with a guaranteed safe ride home'
    ],
    suggestedSearch: 'Beirut nightlife Mar Mikhael Gemmayze bars late night safe ride',
    visualTheme: 'A clean modern taxi picking up passengers in vibrant Mar Mikhael or Gemmayze at night, historic Lebanese building facades, warm fairy lights from outdoor bars, cinematic aesthetic'
  },
  {
    id: 'ski_and_faraya_mzaar',
    name: 'Faraya, Mzaar & Kfardebian Ski & Winter Transfers',
    intent: 'Skiers, snowboarders, and winter tourists traveling from Beirut to Faraya Mzaar, Kfardebian, or Cedars of God needing snow-ready vehicles, equipment space, and expert mountain drivers.',
    matchTerms: ['faraya', 'mzaar', 'kfardebian', 'ski', 'snow', 'cedars'],
    primaryKeywords: [
      'taxi to Faraya Mzaar',
      'Faraya ski transfer taxi',
      'taxi to Kfardebian',
      'snow taxi Lebanon with chains',
      'Beirut to Faraya taxi fare',
      'ski gear transport taxi Lebanon',
      'winter mountain taxi Lebanon'
    ],
    secondaryKeywords: [
      'Mzaar ski resort cab',
      'Faraya day trip taxi',
      'Beirut to Cedars ski transfer',
      'snow weekend ride Lebanon'
    ],
    hashtags: [
      '#Faraya',
      '#Mzaar',
      '#FarayaMzaar',
      '#SkiLebanon',
      '#LebanonMountains',
      '#Kfardebian',
      '#WinterInLebanon',
      '#LebanonSki',
      '#AndrewsTaxi'
    ],
    angles: [
      'Hitting the slopes at Faraya Mzaar: Why a private taxi transfer is the smartest way to transport ski gear and boards',
      'Navigating mountain snow and ice safely: Why you need an experienced driver equipped with snow chains',
      'A stress-free winter day trip from Beirut to Kfardebian: Slope time, cozy fireplace lunch, and a warm ride back'
    ],
    suggestedSearch: 'Faraya Mzaar Kfardebian ski season updates Lebanon mountain road conditions',
    visualTheme: 'A modern private SUV taxi driving up a snow-covered mountain road in Faraya Mzaar Lebanon, towering snowbanks, bright winter sunshine, majestic Lebanese mountains'
  },
  {
    id: 'historical_baalbek_tyre_beiteddine',
    name: 'Baalbek, Tyre, Beiteddine & Cultural Day Tours',
    intent: 'Tourists, diaspora, and culture lovers wanting private driver day trips to UNESCO World Heritage sites (Baalbek Roman temples, Tyre Roman ruins, Beiteddine Palace, Jeita Grotto) without crowded tour buses.',
    matchTerms: ['baalbek', 'tyre', 'sour', 'beiteddine', 'jeita', 'harissa', 'chouf'],
    primaryKeywords: [
      'taxi to Baalbek Roman temples',
      'day trip to Tyre Sour ruins by taxi',
      'taxi to Beiteddine palace and Deir el Qamar',
      'taxi to Jeita Grotto and Harissa cable car',
      'Sidon sea castle taxi tour',
      'Anjar ruins taxi trip',
      'Lebanon historical tour private driver'
    ],
    secondaryKeywords: [
      'private chauffeur Baalbek day trip',
      'UNESCO heritage tours Lebanon private car',
      'Chouf cedar reserve taxi',
      'Tyre beach and ruins day trip'
    ],
    hashtags: [
      '#Baalbek',
      '#TyreLebanon',
      '#Beiteddine',
      '#JeitaGrotto',
      '#HarissaLebanon',
      '#DiscoverLebanon',
      '#LebanonHistory',
      '#VisitLebanon',
      '#AndrewsTaxi'
    ],
    angles: [
      'Exploring the colossal Roman temples of Baalbek with a private driver: History, itinerary, and travel tips',
      'Day trip to Tyre (Sour): Ancient Roman ruins, turquoise Mediterranean waters, and fresh seafood by private taxi',
      'Royal history in the Chouf: Visiting Beiteddine Palace and historic Deir el Qamar with a comfortable private chauffeur'
    ],
    suggestedSearch: 'Baalbek temples day trip travel guide Lebanon private driver',
    visualTheme: 'A private car parked near the majestic monumental columns of the Temple of Jupiter in Baalbek, golden hour sunlight, ancient Roman stones, awe-inspiring travel photography'
  },
  {
    id: 'winery_and_food_trails',
    name: 'Bekaa Valley & Mount Lebanon Wine & Culinary Tours',
    intent: 'Wine lovers and culinary enthusiasts planning tastings at Chateau Ksara, Chateau Kefraya, Massaya, Ixsir, and authentic mezze lunches who need a designated chauffeur to drink safely.',
    matchTerms: ['winery', 'wine tour', 'ksara', 'kefraya', 'culinary', 'food tour', 'mezze road'],
    primaryKeywords: [
      'Bekaa wine tour private taxi',
      'Chateau Ksara Kefraya driver',
      'Batroun wineries private driver',
      'Lebanon culinary road trip taxi',
      'authentic Lebanese food tour private driver',
      'wine tasting transport Lebanon'
    ],
    secondaryKeywords: [
      'Lebanon wine tasting chauffeur',
      'Bekaa valley winery day trip',
      'food and wine driver Lebanon',
      'private tour Ksara winery'
    ],
    hashtags: [
      '#LebanonWine',
      '#BekaaValley',
      '#ChateauKsara',
      '#ChateauKefraya',
      '#WineTastingLebanon',
      '#LebaneseFood',
      '#LebanonFoodTour',
      '#CulinaryLebanon',
      '#AndrewsTaxi'
    ],
    angles: [
      'Touring the Bekaa Valley wineries: Taste award-winning Lebanese wines safely with a private designated chauffeur',
      'The ultimate Lebanese food and wine road trip: Savor authentic mountain mezze without worrying about driving',
      'Discovering Mount Lebanon and Batroun boutique wineries with your personal driver'
    ],
    suggestedSearch: 'Chateau Ksara Kefraya wine tasting Bekaa valley private car tour',
    visualTheme: 'A sleek private car driving through lush green grape vineyards in the Bekaa Valley with Mount Lebanon ridges in the background, warm Mediterranean sun, wine country elegance'
  },
  {
    id: 'intercity_tripoli_saida_zahle',
    name: 'Tripoli, Sidon, Zahle & Intercity Commuter Travel',
    intent: 'Travelers and professionals traveling between Lebanon major cities (Beirut - Tripoli, Beirut - Saida, Beirut - Zahle) looking for fast, private, air-conditioned intercity taxis at fixed rates.',
    matchTerms: ['tripoli', 'saida', 'sidon', 'zahle', 'intercity', 'long distance'],
    primaryKeywords: [
      'taxi Beirut to Tripoli',
      'taxi Beirut to Sidon Saida',
      'taxi Beirut to Zahle Bekaa',
      'intercity taxi Lebanon fixed price',
      'long distance private taxi Lebanon',
      'taxi from Beirut to Jounieh Keserwan'
    ],
    secondaryKeywords: [
      'Beirut to North Lebanon cab',
      'Beirut to South Lebanon taxi',
      'comfortable highway taxi Lebanon',
      'Zahle Berdawni day trip taxi'
    ],
    hashtags: [
      '#TripoliLebanon',
      '#Zahle',
      '#Saida',
      '#LebanonCommute',
      '#IntercityTaxi',
      '#BeirutToTripoli',
      '#LebanonBusiness',
      '#AndrewsTaxi'
    ],
    angles: [
      'Beirut to Tripoli in comfort: How to visit the ancient Mamluk souks, citadel, and sweets shops by private taxi',
      'Business or family in Zahle: Reliable, fixed-price transfers between Beirut and the capital of the Bekaa',
      'Traveling to South Lebanon: Fast and dependable private taxi service to Sidon (Saida) and beyond'
    ],
    suggestedSearch: 'Tripoli Lebanon souks citadel day trip taxi travel tips',
    visualTheme: 'A modern taxi cruising along the coastal highway overlooking Tripoli or the historic Sidon Sea Castle on the Mediterranean shore, cinematic travel photography'
  },
  {
    id: 'healthcare_and_senior_care',
    name: 'Medical Rides, Hospital Visits & Senior Mobility in Beirut',
    intent: 'Patients and family members needing prompt, respectful, caring transport to Beirut top medical centers (AUBMC, Hotel Dieu, CMC, St. George) and assistance for elderly relatives.',
    matchTerms: ['aubmc', 'hotel dieu', 'hospital', 'medical', 'elderly', 'senior', 'clinic'],
    primaryKeywords: [
      'medical taxi ride Beirut',
      'taxi to AUBMC hospital',
      'taxi to Hotel Dieu de France',
      'safe taxi for elderly parents Beirut',
      'hospital appointment driver Beirut',
      'non emergency medical transport Lebanon'
    ],
    secondaryKeywords: [
      'taxi to Clemenceau CMC',
      'reliable taxi for doctor visit Beirut',
      'senior citizen transportation Lebanon',
      'caring taxi service Beirut'
    ],
    hashtags: [
      '#AUBMC',
      '#HotelDieu',
      '#BeirutHealthcare',
      '#MedicalTaxi',
      '#SeniorCareLebanon',
      '#SafeTaxiLebanon',
      '#LebanonCare',
      '#AndrewsTaxi'
    ],
    angles: [
      'Getting to Beirut hospitals without stress: Dedicated taxi rides for doctor appointments and medical checkups',
      'Caring for aging parents in Lebanon: How to book dependable, patient, and respectful drivers for your family',
      'Punctual medical transport to AUBMC and Hotel Dieu: Smooth door-to-door rides when timing matters most'
    ],
    suggestedSearch: 'AUBMC Hotel Dieu hospital taxi transport Beirut Lebanon healthcare',
    visualTheme: 'A clean, comfortable sedan taxi parked calmly along a quiet street near Beirut medical center, driver opening the door with courtesy, clean and caring atmosphere'
  },
  {
    id: 'university_student_commutes',
    name: 'University Student Commutes (AUB, LAU, USJ, NDU)',
    intent: 'College students and their parents seeking punctual, safe morning pickups and late evening study ride packages across Greater Beirut campuses.',
    matchTerms: ['aub', 'lau', 'usj', 'ndu', 'student', 'university', 'campus', 'college'],
    primaryKeywords: [
      'student taxi Beirut AUB LAU',
      'university student ride service Lebanon',
      'taxi to USJ campus',
      'taxi to NDU Louaize',
      'safe ride home college student Beirut',
      'student monthly taxi Lebanon'
    ],
    secondaryKeywords: [
      'Bliss street taxi pickup',
      'Byblos campus LAU taxi',
      'student ride share Lebanon',
      'safe campus commute Beirut'
    ],
    hashtags: [
      '#AUB',
      '#LAU',
      '#USJ',
      '#NDU',
      '#LebanonStudents',
      '#StudentLifeBeirut',
      '#SafeCommuteLebanon',
      '#BeirutCampus',
      '#AndrewsTaxi'
    ],
    angles: [
      'Campus commute made easy: Safe, punctual taxi rides for AUB, LAU, USJ, and NDU students',
      'Peace of mind for parents: Booking reliable daily university transport for your children in Beirut',
      'Exam week and late study groups: Guaranteed 24/7 safe rides home from campus libraries'
    ],
    suggestedSearch: 'AUB LAU university student life transport Beirut campus commute',
    visualTheme: 'A modern taxi parked near the historic stone gates and tree-lined walkways of a Beirut university campus like AUB on Bliss Street, bright energetic daytime atmosphere'
  },
  {
    id: 'daily_office_and_work_commutes',
    name: 'Daily Office & Work Commutes – Call for Best Price Quote',
    intent: 'Working professionals, office employees, and corporate staff in Beirut and Mount Lebanon seeking reliable, daily morning and evening door-to-door rides to work without traffic stress, high fuel costs, or parking headaches, with affordable monthly/daily package quotes.',
    matchTerms: ['office commute', 'work commute', 'daily ride', 'daily work', 'monthly quote', 'best price quote', 'work taxi', 'office taxi'],
    primaryKeywords: [
      'daily office taxi Beirut',
      'work commute taxi Lebanon',
      'daily ride to work quote',
      'monthly taxi package Beirut best price',
      'office staff transportation Lebanon',
      'daily work driver Lebanon best quote',
      'call taxi for daily ride quote Beirut',
      'affordable daily commute taxi Lebanon'
    ],
    secondaryKeywords: [
      'commute to Downtown Beirut taxi',
      'monthly ride quote Lebanon',
      'work taxi service Hamra Achrafieh',
      'reliable daily morning driver Beirut',
      'best price taxi quote Lebanon'
    ],
    hashtags: [
      '#DailyCommuteLebanon',
      '#OfficeRideBeirut',
      '#BeirutWorkCommute',
      '#DailyTaxiQuote',
      '#BestPriceTaxi',
      '#WorkInBeirut',
      '#CommuteToWork',
      '#BeirutProfessionals',
      '#AndrewsTaxi'
    ],
    angles: [
      'Tired of Beirut morning traffic and parking hassles? Call us today to get your daily office ride quote at the best price',
      'Monthly work commute packages in Greater Beirut: Why professionals choose a dedicated daily driver over car stress and rising fuel prices',
      'From your doorstep to your office desk on time every morning: Get your tailored daily work ride quote at an unbeatable rate'
    ],
    suggestedSearch: 'daily work office commute transport taxi Beirut monthly quote best price',
    visualTheme: 'A stylish professional stepping out of a clean modern taxi in front of a busy modern office building in Beirut Downtown or Achrafieh during morning rush hour, crisp sunlight, confident corporate vibe'
  },
  {
    id: 'daily_school_commutes',
    name: 'Daily School Pickups & Student Commutes – Safe Rides at Best Price',
    intent: 'Parents seeking trusted, punctual daily morning school drop-offs and afternoon pick-ups for their children across Greater Beirut and Mount Lebanon, wanting complete safety, vetted drivers, and the best monthly price quote.',
    matchTerms: ['school commute', 'school pickup', 'school drop off', 'children taxi', 'kids taxi', 'school ride quote', 'school transport'],
    primaryKeywords: [
      'daily school taxi Beirut',
      'school pickup and drop off taxi Lebanon',
      'safe taxi for kids school Lebanon',
      'monthly school transport Lebanon best price',
      'school ride quote best price Beirut',
      'call for school taxi quote Lebanon',
      'trusted school driver Lebanon',
      'daily student transport best quote'
    ],
    secondaryKeywords: [
      'nursery school pickup taxi Beirut',
      'affordable school commute quote',
      'school transport Metn Keserwan',
      'safe children ride service Lebanon',
      'charbel abou zeid 30 years experience'
    ],
    hashtags: [
      '#SchoolRideLebanon',
      '#SafeSchoolTransport',
      '#BeirutSchoolRide',
      '#DailySchoolCommute',
      '#LebanonParents',
      '#BestPriceSchoolRide',
      '#KidsSafetyLebanon',
      '#AndrewsTaxi'
    ],
    angles: [
      'Safe, punctual daily school drop-offs and pickups: Call us now to lock in your child school ride quote at the best price',
      'Why Lebanese parents trust Andrew Taxi for daily school commutes: 30+ years of reliability, vetting, and family care',
      'Beat the morning school run stress: Affordable monthly school transport packages with door-to-door safety'
    ],
    suggestedSearch: 'daily school transport service Beirut Lebanon children pickup dropoff best quote',
    visualTheme: 'A friendly courteous driver gently opening the car door for a school student with backpack in front of a respected school gate in Lebanon, safe morning light, reassuring family atmosphere'
  },
  {
    id: 'corporate_and_executive_vip',
    name: 'Corporate Travel, Executive Chauffeur & Business Meetings',
    intent: 'Business travelers, corporate executives, NGOs, and foreign delegations in Beirut needing dedicated full-day drivers, professional invoicing, and pristine executive sedans.',
    matchTerms: ['corporate', 'executive', 'vip', 'business meeting', 'delegation', 'chauffeur'],
    primaryKeywords: [
      'corporate taxi service Beirut',
      'executive private driver Lebanon',
      'taxi for business meetings Beirut Downtown',
      'full day driver rental Lebanon',
      'embassy taxi chauffeur Lebanon',
      'business travel expense taxi Lebanon'
    ],
    secondaryKeywords: [
      'VIP chauffeur Beirut',
      'hotel transfer Phoenicia Beirut',
      'corporate account taxi Lebanon',
      'executive car with driver Lebanon'
    ],
    hashtags: [
      '#CorporateTravelLebanon',
      '#ExecutiveDriverBeirut',
      '#BeirutBusiness',
      '#VIPChauffeurLebanon',
      '#LebanonBusinessTravel',
      '#AndrewsTaxi'
    ],
    angles: [
      'Executive chauffeur service in Beirut: Professional transport for business meetings and corporate delegations',
      'Full-day private driver rental in Lebanon: Multi-stop itineraries, punctuality, and formal invoicing',
      'Hotel to boardroom: Seamless business transfers between Beirut luxury hotels and Downtown offices'
    ],
    suggestedSearch: 'Beirut Downtown corporate business executive travel private driver',
    visualTheme: 'A pristine luxury black sedan parked in Beirut Central District Downtown near modern architecture and manicured palm trees, sharp business aesthetic, photorealistic'
  },
  {
    id: 'weddings_and_special_events',
    name: 'Weddings, Beach Parties & Special Event Guest Transfers',
    intent: 'Wedding guests and hosts needing reliable group transport to mountain or coastal venues (Chouf, Broummana, Batroun, Byblos), ensuring guests return safely after late-night parties.',
    matchTerms: ['wedding', 'event transportation', 'party shuttle', 'celebration', 'beach club taxi'],
    primaryKeywords: [
      'wedding guest taxi service Lebanon',
      'wedding shuttle van Lebanon',
      'event transportation Beirut',
      'private driver for weddings Lebanon',
      'beach club taxi Batroun Damour',
      'safe ride after wedding party Lebanon'
    ],
    secondaryKeywords: [
      'Lebanon wedding guest transportation',
      'mountain wedding venue taxi',
      'party shuttle Lebanon',
      'late night wedding driver'
    ],
    hashtags: [
      '#LebanonWeddings',
      '#BeirutEvents',
      '#WeddingTransportLebanon',
      '#LebanonParty',
      '#BeachClubLebanon',
      '#AndrewsTaxi'
    ],
    angles: [
      'Attending a Lebanese wedding in the mountains? Why you should book your ride in advance instead of driving tired',
      'Wedding guest transfers in Lebanon: Minivans and private cars to get your loved ones home safely',
      'Summer beach clubs and concerts: Hassle-free drop-off and pickup in Batroun and Damour'
    ],
    suggestedSearch: 'Lebanon outdoor wedding venues transport Mount Lebanon party guest ride',
    visualTheme: 'A fleet of clean private cars and passenger vans parked at the entrance of an illuminated luxury outdoor wedding venue in Mount Lebanon, warm celebratory ambient lights'
  },
  {
    id: 'lebanon_taxi_pricing_guide',
    name: 'Lebanon Taxi Survival Guide: Fares, Fixed vs Meter, Apps',
    intent: 'Visitors, diaspora, and expats researching transportation in Lebanon, asking how much taxis cost, whether apps like Uber work reliably, and how to avoid taxi scams.',
    matchTerms: ['pricing guide', 'how much', 'taxi fares', 'scams', 'meter', 'cost', 'currency'],
    primaryKeywords: [
      'taxi fares in Lebanon guide',
      'how much is a taxi in Beirut',
      'meter vs fixed price taxi Lebanon',
      'how to avoid taxi scams Beirut airport',
      'taxi vs Uber in Lebanon',
      'how to get around Lebanon without a car'
    ],
    secondaryKeywords: [
      'Lebanon taxi rates USD',
      'service vs taxi Lebanon',
      'getting around Beirut without driving',
      'Lebanon tourist transportation tips'
    ],
    hashtags: [
      '#LebanonTravelGuide',
      '#BeirutTravelTips',
      '#TaxiFaresLebanon',
      '#VisitBeirut',
      '#LebanonOnABudget',
      '#BeirutTips',
      '#AndrewsTaxi'
    ],
    angles: [
      'How taxi pricing works in Lebanon: Fixed rates vs street hailing and why pre-agreeing your fare is critical',
      'Getting around Lebanon without renting a car: The complete expat and traveler mobility handbook',
      'Taxi vs rideshare apps in Beirut: Why pre-scheduled direct WhatsApp booking gives guaranteed reliability'
    ],
    suggestedSearch: 'Lebanon taxi fares transportation guide how to travel get around Beirut',
    visualTheme: 'A cozy view from inside a clean private taxi looking out at a picturesque Lebanese road, clear dashboard, sun shining over the Mediterranean horizon, authentic travel moment'
  },
  {
    id: 'pet_friendly_and_bulky_luggage',
    name: 'Pet-Friendly Taxi Rides & Bulky Luggage Transfers',
    intent: 'Pet parents needing a pet-friendly taxi to vets/groomers/beaches, and travelers moving with excess baggage, boxes, or large equipment.',
    matchTerms: ['pet friendly', 'dog', 'cat', 'large luggage', 'boxes', 'moving boxes', 'oversized'],
    primaryKeywords: [
      'pet friendly taxi Beirut Lebanon',
      'taxi for dog cat vet visit Lebanon',
      'large van taxi extra luggage Lebanon',
      'moving boxes taxi Beirut',
      'oversized luggage transport Lebanon',
      'airport taxi excess baggage Lebanon'
    ],
    secondaryKeywords: [
      'pet taxi Beirut',
      'dog friendly cab Lebanon',
      'cargo taxi Beirut',
      'spacious minivan taxi Lebanon'
    ],
    hashtags: [
      '#PetFriendlyLebanon',
      '#BeirutPets',
      '#LebanonDogs',
      '#BeirutCats',
      '#PetTaxiBeirut',
      '#LargeLuggageTaxi',
      '#AndrewsTaxi'
    ],
    angles: [
      'Traveling with pets in Beirut: How to book a stress-free, welcoming ride for your dog or cat',
      'Moving home or heading to the airport with 5+ suitcases? Why you need our spacious van taxi',
      'Taking your dog to the beach or mountains: Pet-friendly rides across Lebanon with zero hassle'
    ],
    suggestedSearch: 'pet friendly taxi services Beirut dog cat vet ride Lebanon',
    visualTheme: 'A spacious clean SUV or minivan taxi with open doors in a sunny Lebanese neighborhood, ready for family travel with ample cargo room, warm friendly lighting'
  },
  {
    id: 'shopping_and_leisure_errands',
    name: 'Stress-Free Shopping Trips & City Errands in Beirut',
    intent: 'Shoppers visiting ABC Achrafieh, ABC Dbayeh, City Centre Hazmieh, or Beirut Souks who want to skip 30+ minutes of circling for parking and load packages easily.',
    matchTerms: ['shopping taxi', 'abc achrafieh', 'mall', 'city errands', 'dbayeh mall', 'city centre'],
    primaryKeywords: [
      'shopping taxi Beirut ABC Achrafieh',
      'taxi to City Centre Beirut Hazmieh',
      'taxi to ABC Dbayeh',
      'Beirut Souks shopping driver',
      'stress free shopping taxi Lebanon',
      'chauffeur for day errands Beirut'
    ],
    secondaryKeywords: [
      'Dbayeh shopping taxi',
      'mall shuttle Beirut',
      'personal errand driver Lebanon',
      'easy parking taxi Beirut'
    ],
    hashtags: [
      '#ShoppingInBeirut',
      '#ABCAchrafieh',
      '#ABCDbayeh',
      '#BeirutShopping',
      '#LebanonLifestyle',
      '#AndrewsTaxi'
    ],
    angles: [
      'Skip the mall parking nightmare: Why booking a shopping taxi to ABC Achrafieh or Dbayeh is pure luxury',
      'Full-day errands across Greater Beirut: Having your own on-call driver makes busy days effortless',
      'Gifts, fashion, and dining: Exploring Beirut premier shopping destinations without car stress'
    ],
    suggestedSearch: 'ABC Achrafieh Dbayeh Beirut shopping malls parking stress free',
    visualTheme: 'A premium taxi waiting smoothly in front of a modern upscale shopping boulevard in Beirut, warm late afternoon sun, sophisticated urban atmosphere'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// HISTORICAL DEDUPLICATION & SELECTION
// Scans existing blog markdown files to penalize overused topics and rotate fresh ones
// ─────────────────────────────────────────────────────────────────────────────
function getRecentPostHistory() {
  if (!fs.existsSync(POSTS_DIR)) return { recentTitles: [], allTitles: [] };
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  
  const posts = files.map(file => {
    try {
      const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let date = '', title = file.replace('.md', ''), keywords = '', category = '';
      if (match) {
        const fm = match[1];
        title = fm.match(/title:\s*["']?([^"'\n\r]+)["']?/)?.[1] || title;
        date = fm.match(/date:\s*["']?([^"'\n\r]+)["']?/)?.[1] || '';
        keywords = fm.match(/keywords:\s*["']?([^"'\n\r]+)["']?/)?.[1] || '';
        category = fm.match(/category:\s*["']?([^"'\n\r]+)["']?/)?.[1] || '';
      }
      return { file, title, date, keywords, category, time: date ? new Date(date).getTime() : 0 };
    } catch {
      return null;
    }
  }).filter(Boolean).sort((a, b) => b.time - a.time);

  return {
    recentPosts: posts,
    recentTitles: posts.slice(0, 20).map(p => p.title),
    allTitles: posts.map(p => p.title.toLowerCase()),
  };
}

function selectTopicPillar(history) {
  const { recentTitles, allTitles } = history;
  
  const scoredPillars = TOPIC_PILLARS.map(pillar => {
    let recentHits = 0;
    let totalHits = 0;

    // Check recent 6 posts for this pillar's terms
    const recent6Text = recentTitles.slice(0, 6).join(' ').toLowerCase();
    for (const term of pillar.matchTerms) {
      if (recent6Text.includes(term.toLowerCase())) {
        recentHits += 2;
      }
    }

    // Check overall usage across all titles
    const allTitlesText = allTitles.join(' ');
    for (const term of pillar.matchTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = allTitlesText.match(regex);
      if (matches) totalHits += matches.length;
    }

    return {
      pillar,
      score: recentHits * 10 + totalHits,
      recentHits,
      totalHits,
    };
  });

  // Sort by score ascending (lowest score = least used recently)
  scoredPillars.sort((a, b) => a.score - b.score);

  // Group least-used pillars (score <= lowest score + 1)
  const minScore = scoredPillars[0].score;
  const topCandidates = scoredPillars.filter(p => p.score <= minScore + 1);

  // Deterministic seed based on day of year to ensure stability and continuous rotation
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  
  const selectedObj = topCandidates[dayOfYear % topCandidates.length];
  const selectedPillar = selectedObj.pillar;

  // Pick an angle within the selected pillar
  const angleIndex = dayOfYear % selectedPillar.angles.length;
  const selectedAngle = selectedPillar.angles[angleIndex];

  return {
    pillar: selectedPillar,
    angle: selectedAngle,
    recentTitles: recentTitles.slice(0, 15),
  };
}

async function braveSearch(query, count = 8) {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return 'Search is unavailable: no API key. Write from your own knowledge.';
  if (!query) return 'No query.';

  log(`  Brave search: "${query}"`);
  try {
    const response = await fetch(`${BRAVE_URL}?q=${encodeURIComponent(query)}&count=${count}`, {
      headers: { accept: 'application/json', 'x-subscription-token': apiKey },
    });
    if (!response.ok) return `Search failed: HTTP ${response.status}`;
    const data = await response.json();
    return (data?.web?.results || []).map(r => `${r.title}\n${r.description}`).join('\n\n');
  } catch (e) {
    return `Search failed: ${e.message}`;
  }
}

const BRAVE_TOOL = {
  name: 'brave_search',
  description: 'Search the web for up-to-date local travel, route, or destination information in Lebanon.',
  input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
};

const SYSTEM_PROMPT = `You are the lead SEO content strategist and writer for Andrews Taxi (Andrew's Taxi), Lebanon's premier 24/7 taxi and private driver service.
BRAND VOICE: Direct, professional, authoritative, transparent, and deeply knowledgeable about Lebanon's roads, travel habits, and local culture.
CORE VALUE PROPOSITIONS: Fixed transparent pricing in USD/LBP, 24/7 availability, flight delay tracking, clean air-conditioned vehicles, professional courteous drivers with 30+ years of local experience (founded by Charbel Abou Zeid), instant WhatsApp booking (+961 3 301 019).

CRITICAL DIRECTIVE - TOPIC FRESHNESS & HIGH-INTENT KEYWORDS:
Your primary objective is to rank on Google for high-converting taxi search queries that real people in Lebanon and arriving tourists actually type into Google.
DO NOT repeat overused topics like generic Byblos/Batroun coastal day trips. You MUST focus entirely on the assigned pillar, target search keywords, and hashtags.

SEO WRITING REQUIREMENTS:
1. Title: Engaging, click-worthy, includes the primary Google search keyword naturally, under 65 characters where possible.
2. Structure: Use clear Markdown headings (H1, H2, H3), bullet points, and actionable tips.
3. Keyword Integration: Naturally weave the primary and secondary search queries into the title, introductory paragraph, subheadings, and body without keyword stuffing.
4. Local Relevance: Mention real Lebanese roads (Autostrade, mountain passes), specific neighborhoods (Achrafieh, Hamra, Badaro, Mar Mikhael, Jounieh, etc.), landmarks, and practical advice.
5. Direct Calls-to-Action: Direct readers to check our fare estimator or call / message on WhatsApp (+961 3 301 019) for immediate booking.
6. Supported Zones: Naturally mention and link our pickup/dropoff zones to our fare estimator: e.g. [Beirut Airport (BEY)](https://www.andrewstaxi.com/#fare-estimator).
\${CATALOGUE}

SPECIAL FOCUS - DAILY COMMUTES (OFFICE, WORK, SCHOOL, UNIVERSITY):
Whenever covering daily rides, office commutes, university travel, or school pickups and drop-offs:
- Strongly emphasize the direct call to action: "Call us or message us on WhatsApp at +961 3 301 019 to get your customized quote at the best price!"
- Highlight punctuality, reliable daily schedules, 30+ years experienced vetted drivers, child safety, and how pre-booking daily or monthly rides saves commuters money compared to gas, parking fees, and vehicle wear-and-tear.


BILINGUAL FORMAT REQUIREMENT:
1. Write the full blog post in English first.
2. At the end of the English post, include a dedicated "🏷️ Popular Searches & Tags" section with high-intent keywords and hashtags.
3. Follow immediately with a complete, fluent, professional Arabic translation under the heading "## Arabic Translation / ترجمة عربية".
4. End the Arabic post with the Arabic equivalent "🏷️ وسوم وكلمات بحث شائعة".

REQUIRED FRONTMATTER FORMAT:
Return ONLY valid Markdown starting with YAML frontmatter:
---
title: "Catchy Title Containing Primary Google Keyword"
date: "\${DATE}"
excerpt: "Compelling 150-160 character meta description answering user search intent with primary keyword."
keywords: "comma, separated, high, intent, search, keywords"
hashtags: "#BeirutTaxi #LebanonTaxi #TaxiNearMe #SpecificTags"
category: "Category Name"
---
[English Blog Post]

---
### 🏷️ Popular Searches & Tags
**Keywords:** [list keywords]
**Tags:** [list hashtags]

## Arabic Translation / ترجمة عربية
[Arabic Blog Post]

---
### 🏷️ وسوم وكلمات بحث شائعة
[Arabic hashtags and search terms]
`;

async function callAnthropicRaw(apiKey, body) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Anthropic Error: ${await response.text()}`);
  return await response.json();
}

async function generateArticle(apiKey, catalogue) {
  const history = getRecentPostHistory();
  const selection = selectTopicPillar(history);
  const { pillar, angle, recentTitles } = selection;

  log(`Target Pillar: "${pillar.name}"`);
  log(`Target Angle: "${angle}"`);
  log(`Primary Keywords: ${pillar.primaryKeywords.slice(0, 4).join(', ')}`);

  const catText = catalogue.map(c => `- "${c.title}" -> ${c.url}`).join('\n');

  const userPrompt = `Write today's SEO blog post (${todayISO()}) strictly focused on this topic pillar:

TARGET CATEGORY: ${pillar.name}
TARGET FOCUS ANGLE: ${angle}
SEARCH INTENT: ${pillar.intent}

PRIMARY GOOGLE SEARCH QUERIES (MUST BE PROMINENTLY FEATURED):
${pillar.primaryKeywords.join(', ')}

SECONDARY SEARCH KEYWORDS:
${pillar.secondaryKeywords.join(', ')}

MANDATORY HASHTAGS:
${pillar.hashtags.join(' ')}

RECENT TITLES ALREADY COVERED (STRICTLY FORBIDDEN - DO NOT REPEAT THESE TOPICS OR CONCEPTS):
${recentTitles.map(t => `- ${t}`).join('\n')}
Under NO circumstances write about generic Byblos/Batroun coastal day trips or repeat any of the above titles.

SUGGESTED INITIAL WEB SEARCH QUERY (if needed for up-to-date details):
"${pillar.suggestedSearch}"

COMMUTER & QUOTE CALL-TO-ACTION DIRECTIVE:
If this post covers daily rides, office commutes, work transport, or school pickups/drop-offs, you MUST include clear callouts stating:
"Call us or message us on WhatsApp at +961 3 301 019 to get your daily ride quote at the best price!" and explain how our customized monthly/daily rates offer guaranteed affordability, safety, and punctuality.

Now write the complete, comprehensive, high-converting bilingual blog post adhering to all guidelines.`;


  const messages = [{ role: 'user', content: userPrompt }];
  let searches = 0;

  try {
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const data = await callAnthropicRaw(apiKey, {
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT.replace('${CATALOGUE}', catText).replace('${DATE}', todayISO()),
        messages,
        tools: [BRAVE_TOOL]
      });

      const blocks = data.content || [];
      const toolUses = blocks.filter(b => b.type === 'tool_use');
      if (toolUses.length === 0) {
        const textContent = blocks.filter(b => b.type === 'text').map(b => b.text).join('').trim();
        return { markdown: textContent, pillar };
      }

      messages.push({ role: 'assistant', content: blocks });
      const results = [];
      for (const tu of toolUses) {
        const res = searches >= MAX_SEARCHES ? 'Budget exhausted.' : await braveSearch(tu.input?.query || pillar.suggestedSearch);
        searches++;
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: res });
      }
      messages.push({ role: 'user', content: results });
    }
    return {
      markdown: `---
title: "AI Timeout Error"
date: "${todayISO()}"
excerpt: "The AI took too many rounds to finish."
keywords: "taxi, lebanon"
hashtags: "#BeirutTaxi"
category: "General"
---
The AI did not finish in time.`,
      pillar
    };
  } catch (err) {
    return {
      markdown: `---
title: "AI Generation Error"
date: "${todayISO()}"
excerpt: "Failed to generate blog post due to an API error."
keywords: "taxi, lebanon"
hashtags: "#BeirutTaxi"
category: "General"
---
We encountered an error while generating today's blog post: ${err.message}`,
      pillar
    };
  }
}

async function cloudflareImage(prompt) {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const model = process.env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';

  if (!accountId || !token) {
    throw new Error('Missing Cloudflare Secrets! CF_ACCOUNT_ID and CF_API_TOKEN must be set in GitHub Repository Secrets.');
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt: prompt.slice(0, 2000) }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`CF HTTP ${response.status}: ${errText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    if (json.success === false) {
      throw new Error(`CF AI Error: ${JSON.stringify(json.errors)}`);
    }
    const b64 = json.result?.image || json.result;
    if (typeof b64 === 'string') {
      return { buffer: Buffer.from(b64, 'base64'), extension: 'png' };
    }
    throw new Error('Unexpected CF JSON response format: ' + JSON.stringify(json).slice(0, 200));
  }

  return { buffer: Buffer.from(await response.arrayBuffer()), extension: 'png' };
}

function buildRealisticImagePrompt(pillar, title, excerpt) {
  const combined = `${pillar?.name || ''} ${pillar?.id || ''} ${title || ''} ${excerpt || ''}`.toLowerCase();

  // If about Beirut Airport or general city transit, NEVER generate fake airport/terminal architecture!
  // Instead: pristine modern white taxi car with clean plain doors and Andrew's logo
  if (combined.includes('airport') || combined.includes('hariri') || combined.includes('bey')) {
    return 'Commercial automotive photography of a pristine modern white luxury sedan taxi with a classic taxi roof light, parked smoothly on a clean sunlit asphalt road in Lebanon. The car body and doors are completely smooth, solid paint with ABSOLUTELY NO NUMBERS, NO PHONE NUMBERS, NO DECALS, NO TEXT, NO WRITING, and a blank clean license plate. Shallow depth of field, natural daylight, photorealistic, 8k resolution. Zero CGI, no fake text, no watermark.';
  }

  // Real ancient open-air landmarks (only where AI can replicate authentic stone ruins without fake buildings)
  if (combined.includes('baalbek') || combined.includes('jupiter') || combined.includes('bacchus')) {
    return 'A super-realistic photograph at the ancient Roman ruins of Baalbek in Lebanon. The colossal towering golden sandstone Roman columns of the Temple of Jupiter and Temple of Bacchus under a clear blue sky. In the foreground along the access road, a modern clean sedan taxi is parked. The taxi car has a small yellow taxi roof sign, but the car body and doors are completely plain, clean solid paint with ABSOLUTELY NO NUMBERS, NO PHONE NUMBERS, NO DECALS, NO TEXT, blank clean license plate. Photorealistic 35mm documentary photography, natural daylight. Zero CGI, no fake text, no watermark.';
  }

  if (combined.includes('byblos') || combined.includes('jbeil')) {
    return 'A super-realistic photograph at the historic ancient Phoenician stone harbor of Byblos (Jbeil) in Lebanon. The iconic medieval Crusader sea tower and ancient stone fortifications by calm turquoise Mediterranean waters with traditional fishing boats in the port. In the foreground along the coastal road, a modern clean sedan taxi is parked. The taxi car has a small yellow taxi roof sign, but the car body and doors are completely plain, clean solid paint with ABSOLUTELY NO NUMBERS, NO PHONE NUMBERS, NO DECALS, NO TEXT, blank clean license plate. Photorealistic 35mm documentary photography, sunny Mediterranean daylight. Zero CGI, no fake text, no watermark.';
  }

  if (combined.includes('faraya') || combined.includes('mzaar') || combined.includes('kfardebian') || combined.includes('ski')) {
    return 'A super-realistic photograph at Faraya Mzaar in Mount Lebanon. An authentic Lebanese mountain road flanked by clean snowbanks with snow-capped Lebanese mountain peaks under crisp winter sunshine. A modern clean silver SUV taxi equipped for mountain roads is parked along the road. The car body and doors are completely plain, clean solid paint with ABSOLUTELY NO NUMBERS, NO PHONE NUMBERS, NO DECALS, NO TEXT, blank clean license plate. Photorealistic winter photography, 35mm lens. Zero CGI, no fake text, no watermark.';
  }

  // For office, school, work, taxi near me, pricing, and all other topics where buildings might look fake:
  // Default strictly to a pristine modern taxi car with clean plain doors (zero numbers) ready for Andrew's logo!
  return 'Commercial automotive photography of a pristine modern clean taxi car (sedan or SUV) parked smoothly on a clean sunlit asphalt road in Lebanon. The taxi car has a small yellow taxi roof sign, but the car body and doors are completely plain, clean solid paint with ABSOLUTELY NO NUMBERS, NO PHONE NUMBERS, NO DECALS, NO TEXT, NO WRITING, and a blank clean license plate. Shallow depth of field, elegant natural daylight, sharp focus, photorealistic, 8k resolution. Zero CGI, no fake text, no watermark.';
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) fail('ANTHROPIC_API_KEY missing');

  const catalogue = loadCatalogue();
  const { markdown, pillar } = await generateArticle(apiKey, catalogue);

  let title = 'taxi-post', excerpt = '', keywords = '', hashtags = '', category = pillar?.name || 'Taxi Service';
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (match) {
    const fm = match[1];
    const tLine = fm.match(/^title:\s*(.+)$/m);
    if (tLine) title = tLine[1].trim().replace(/^["']|["']$/g, '');
    const eLine = fm.match(/^excerpt:\s*(.+)$/m);
    if (eLine) excerpt = eLine[1].trim().replace(/^["']|["']$/g, '');
    const kLine = fm.match(/^keywords:\s*(.+)$/m);
    if (kLine) keywords = kLine[1].trim().replace(/^["']|["']$/g, '');
    const hLine = fm.match(/^hashtags:\s*(.+)$/m);
    if (hLine) hashtags = hLine[1].trim().replace(/^["']|["']$/g, '');
    const cLine = fm.match(/^category:\s*(.+)$/m);
    if (cLine) category = cLine[1].trim().replace(/^["']|["']$/g, '');
  }
  const slug = slugify(title) || 'taxi-post';

  const imagePrompt = buildRealisticImagePrompt(pillar, title, excerpt);

  let imagePath = '/featured.jpeg';
  try {
    const { buffer, extension } = await cloudflareImage(imagePrompt);
    fs.mkdirSync(IMAGES_DIR, { recursive: true });

    const logoPath = path.join(process.cwd(), 'public', 'logo-white.png');
    const logoBuffer = await sharp(logoPath).resize({ width: 180 }).toBuffer();

    const finalBuffer = await sharp(buffer)
      .composite([{ input: logoBuffer, gravity: 'southeast' }])
      .toBuffer();

    const fileName = `${slug}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
    fs.writeFileSync(path.join(IMAGES_DIR, fileName), finalBuffer);
    imagePath = `/images/${fileName}`;
  } catch (e) {
    log(`Image gen fallback to featured image: ${e.message}`);
    imagePath = '/featured.jpeg';
  }


  const finalMd = markdown.replace(/^---([\s\S]*?)---/, `---\nimage: "${imagePath}"$1---`);
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(POSTS_DIR, `${slug}.md`), finalMd);
  log(`Created ${slug}.md`);

  // Update Sitemap
  const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    try {
      let sitemap = fs.readFileSync(sitemapPath, 'utf8');
      const newUrl = `
  <url>
    <loc>${SITE_URL}/blog/${slug}</loc>
    <lastmod>${todayISO()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
      sitemap = sitemap.replace('</urlset>', newUrl.trim() + '\n</urlset>');
      fs.writeFileSync(sitemapPath, sitemap);
      log(`Updated sitemap.xml with ${slug}`);
    } catch (err) {
      log(`Failed to update sitemap: ${err.message}`);
    }
  }

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `image=${imagePath}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `excerpt=${excerpt}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `keywords=${keywords}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `hashtags=${hashtags}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `category=${category}\n`);
  }
}

export { TOPIC_PILLARS, getRecentPostHistory, selectTopicPillar };

// Run main if executed directly via CLI
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch(e => fail(e.stack || e.message));
}


