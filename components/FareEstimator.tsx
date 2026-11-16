import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  Calculator,
  MessageCircle,
  RefreshCw,
  Calendar,
  User,
  LocateFixed,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  ArrowLeftRight,
} from 'lucide-react';
import { SECONDARY_PHONE_NUMBER_CLEAN, FARE_RULES } from '../constants';
import { formatPrice } from '../pricing';
import type { LocationPoint } from '../types';
import {
  loadGoogleMaps,
  getCurrentBrowserPosition,
  reverseGeocode,
  searchLebanonPlaces,
  calculateDrivingRoute,
  buildGoogleMapsPinUrl,
  type PlaceSuggestion,
} from '../services/googleMaps';

type PinTarget = 'pickup' | 'dropoff';

interface RouteEstimate {
  distanceKm: number;
  extraKm: number;
  durationMinutes: number | null;
  finalFareUsd: number;
  minFareApplied: boolean;
  path: Array<{ lat: number; lng: number }>;
}

interface LocationFieldProps {
  id: string;
  label: string;
  target: PinTarget;
  text: string;
  point: LocationPoint | null;
  activePinTarget: PinTarget | null;
  locating: boolean;
  error?: string;
  placeholder: string;
  icon: React.ReactNode;
  onTextChange: (value: string) => void;
  onSelectPoint: (point: LocationPoint) => void;
  onLocateMe: () => void;
  onToggleMapPin: () => void;
}

const formatDateLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatTimeLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDisplayDateTime = (dateStr: string, timeStr: string): string => {
  if (!dateStr || !timeStr) return 'Not set';
  const parsed = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(parsed.getTime())) return `${dateStr} ${timeStr}`;
  return parsed.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const LocationField: React.FC<LocationFieldProps> = ({
  id,
  label,
  target,
  text,
  point,
  activePinTarget,
  locating,
  error,
  placeholder,
  icon,
  onTextChange,
  onSelectPoint,
  onLocateMe,
  onToggleMapPin,
}) => {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    // Skip autocomplete query when text already matches the locked coordinate title
    if (point && text.trim() === point.title.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const query = text.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLebanonPlaces(query);
        if (!cancelled) {
          setSuggestions(results);
          setShowDropdown(results.length > 0);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, point]);

  const handleSuggestionClick = async (suggestion: PlaceSuggestion) => {
    setResolvingId(suggestion.id);
    try {
      const resolved = await suggestion.resolve();
      onSelectPoint(resolved);
      setShowDropdown(false);
    } finally {
      setResolvingId(null);
    }
  };

  const isPinningThis = activePinTarget === target;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-sm font-semibold text-gray-700">
          {label} <span className="text-red-500">*</span>
        </label>
        {point ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pinned
          </span>
        ) : (
          <span className="text-xs text-gray-400">Search, Locate Me, or Pin</span>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {icon}
        </div>
        <input
          id={id}
          type="text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-taxi-yellow focus:border-taxi-yellow text-sm bg-white ${
            error ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
          }`}
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => handleSuggestionClick(s)}
                disabled={resolvingId === s.id}
                className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50 transition-colors flex items-start gap-2.5"
              >
                <MapPin className="w-4 h-4 text-taxi-yellow mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                  <p className="text-xs text-gray-500 truncate">{s.subtitle}</p>
                </div>
                {resolvingId === s.id && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onLocateMe}
          disabled={locating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-taxi-dark text-white hover:bg-gray-800 transition-colors disabled:opacity-60"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-taxi-yellow" /> : <LocateFixed className="w-3.5 h-3.5 text-taxi-yellow" />}
          {locating ? 'Locating...' : 'Locate Me'}
        </button>

        <button
          type="button"
          onClick={onToggleMapPin}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            isPinningThis
              ? 'bg-taxi-yellow text-taxi-dark border-taxi-yellow'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          {isPinningThis ? 'Tap map now...' : 'Pin on Map'}
        </button>

        {point && (
          <a
            href={buildGoogleMapsPinUrl(point.lat, point.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 underline"
          >
            Preview Pin <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};

export const FareEstimator: React.FC = () => {
  const [clientName, setClientName] = useState('');
  const [pickupText, setPickupText] = useState('');
  const [pickupPoint, setPickupPoint] = useState<LocationPoint | null>(null);
  const [dropoffText, setDropoffText] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState<LocationPoint | null>(null);
  const [pickupDate, setPickupDate] = useState(() => formatDateLocal(new Date()));
  const [pickupTime, setPickupTime] = useState('');
  const [selectedSchedulePreset, setSelectedSchedulePreset] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [activePinTarget, setActivePinTarget] = useState<PinTarget | null>('pickup');
  const [locatingTarget, setLocatingTarget] = useState<PinTarget | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [estimate, setEstimate] = useState<RouteEstimate | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropoffMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const activePinTargetRef = useRef<PinTarget | null>(activePinTarget);

  useEffect(() => {
    activePinTargetRef.current = activePinTarget;
  }, [activePinTarget]);

  const clearError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applySelectedPoint = useCallback((target: PinTarget, point: LocationPoint) => {
    if (target === 'pickup') {
      setPickupPoint(point);
      setPickupText(point.title);
      clearError('pickup');
      if (!dropoffPoint) setActivePinTarget('dropoff');
    } else {
      setDropoffPoint(point);
      setDropoffText(point.title);
      clearError('dropoff');
      setActivePinTarget(null);
    }
    setEstimate(null);
    setApiError('');
  }, [dropoffPoint]);

  // Initialize interactive Google Map
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      try {
        const maps = await loadGoogleMaps();
        const { Map } = await maps.importLibrary('maps');
        if (cancelled || !mapContainerRef.current) return;

        const map = new Map(mapContainerRef.current, {
          center: { lat: 33.8938, lng: 35.5018 }, // Beirut / Mount Lebanon
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        map.addListener('click', async (event: any) => {
          const target = activePinTargetRef.current;
          if (!target || !event?.latLng) return;
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          const title = await reverseGeocode(lat, lng);
          applySelectedPoint(target, { title, lat, lng });
        });

        mapInstanceRef.current = map;
        setMapReady(true);
      } catch (err) {
        if (!cancelled) {
          setMapLoadError(err instanceof Error ? err.message : 'Unable to load Google Map.');
        }
      }
    }

    initMap();
    return () => {
      cancelled = true;
    };
  }, [applySelectedPoint]);

  // Keep map markers & route polyline synced with state
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    let cancelled = false;

    async function syncMarkersAndRoute() {
      try {
        const maps = await loadGoogleMaps();
        const { Marker } = await maps.importLibrary('marker');
        const { Polyline } = await maps.importLibrary('maps');
        const { LatLngBounds } = await maps.importLibrary('core');
        if (cancelled) return;

        const map = mapInstanceRef.current;
        const MarkerCtor = Marker || maps.Marker;

        // Pickup marker
        if (pickupPoint && MarkerCtor) {
          if (!pickupMarkerRef.current) {
            pickupMarkerRef.current = new MarkerCtor({
              map,
              position: { lat: pickupPoint.lat, lng: pickupPoint.lng },
              label: 'A',
              title: `Pickup: ${pickupPoint.title}`,
              draggable: true,
            });
            pickupMarkerRef.current.addListener('dragend', async (event: any) => {
              if (!event?.latLng) return;
              const lat = event.latLng.lat();
              const lng = event.latLng.lng();
              const title = await reverseGeocode(lat, lng);
              applySelectedPoint('pickup', { title, lat, lng });
            });
          } else {
            pickupMarkerRef.current.setMap(map);
            pickupMarkerRef.current.setPosition({ lat: pickupPoint.lat, lng: pickupPoint.lng });
            pickupMarkerRef.current.setTitle(`Pickup: ${pickupPoint.title}`);
          }
        } else if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setMap(null);
        }

        // Drop-off marker
        if (dropoffPoint && MarkerCtor) {
          if (!dropoffMarkerRef.current) {
            dropoffMarkerRef.current = new MarkerCtor({
              map,
              position: { lat: dropoffPoint.lat, lng: dropoffPoint.lng },
              label: 'B',
              title: `Drop-off: ${dropoffPoint.title}`,
              draggable: true,
            });
            dropoffMarkerRef.current.addListener('dragend', async (event: any) => {
              if (!event?.latLng) return;
              const lat = event.latLng.lat();
              const lng = event.latLng.lng();
              const title = await reverseGeocode(lat, lng);
              applySelectedPoint('dropoff', { title, lat, lng });
            });
          } else {
            dropoffMarkerRef.current.setMap(map);
            dropoffMarkerRef.current.setPosition({ lat: dropoffPoint.lat, lng: dropoffPoint.lng });
            dropoffMarkerRef.current.setTitle(`Drop-off: ${dropoffPoint.title}`);
          }
        } else if (dropoffMarkerRef.current) {
          dropoffMarkerRef.current.setMap(null);
        }

        // Route polyline
        if (routePolylineRef.current) {
          routePolylineRef.current.setMap(null);
          routePolylineRef.current = null;
        }
        if (estimate?.path?.length && Polyline) {
          routePolylineRef.current = new Polyline({
            path: estimate.path,
            geodesic: true,
            strokeColor: '#111827',
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map,
          });
        }

        // Fit map bounds
        if (pickupPoint && dropoffPoint && LatLngBounds) {
          const bounds = new LatLngBounds();
          bounds.extend({ lat: pickupPoint.lat, lng: pickupPoint.lng });
          bounds.extend({ lat: dropoffPoint.lat, lng: dropoffPoint.lng });
          map.fitBounds(bounds, 64);
        } else if (pickupPoint) {
          map.panTo({ lat: pickupPoint.lat, lng: pickupPoint.lng });
          if ((map.getZoom() || 0) < 14) map.setZoom(14);
        } else if (dropoffPoint) {
          map.panTo({ lat: dropoffPoint.lat, lng: dropoffPoint.lng });
          if ((map.getZoom() || 0) < 14) map.setZoom(14);
        }
      } catch {
        // Ignore transient map sync errors
      }
    }

    syncMarkersAndRoute();
    return () => {
      cancelled = true;
    };
  }, [mapReady, pickupPoint, dropoffPoint, estimate, applySelectedPoint]);

  const handleLocateMe = async (target: PinTarget) => {
    setLocatingTarget(target);
    setApiError('');
    try {
      const coords = await getCurrentBrowserPosition();
      const title = await reverseGeocode(coords.lat, coords.lng);
      applySelectedPoint(target, { title, lat: coords.lat, lng: coords.lng });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to detect your location.';
      setFieldErrors((prev) => ({ ...prev, [target]: message }));
    } finally {
      setLocatingTarget(null);
    }
  };

  const applySchedulePreset = (presetId: string, targetDate: Date) => {
    setPickupDate(formatDateLocal(targetDate));
    setPickupTime(formatTimeLocal(targetDate));
    setSelectedSchedulePreset(presetId);
    clearError('dateTime');
    setEstimate(null);
  };

  const handlePresetMinutes = (presetId: string, minutesFromNow: number) => {
    applySchedulePreset(presetId, new Date(Date.now() + minutesFromNow * 60 * 1000));
  };

  const handlePresetTomorrowMorning = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    applySchedulePreset('tomorrow-9am', tomorrow);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!clientName.trim()) {
      errors.clientName = 'Client name is required.';
    }

    if (!pickupPoint) {
      errors.pickup = 'Please select a pickup point using search, Locate Me, or the map pin.';
    }

    if (!dropoffPoint) {
      errors.dropoff = 'Please select a drop-off point using search, Locate Me, or the map pin.';
    }

    if (!pickupDate || !pickupTime) {
      errors.dateTime = 'Please choose a pickup date and time (or tap a quick preset like ASAP).';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCalculateFare = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm() || !pickupPoint || !dropoffPoint) {
      return;
    }

    setIsCalculating(true);
    try {
      const route = await calculateDrivingRoute(pickupPoint, dropoffPoint);
      const distanceKm = route.distanceKm;
      const extraKm = Math.max(0, Math.round((distanceKm - FARE_RULES.BASE_DISTANCE_KM) * 10) / 10);
      const finalFareUsd = Math.round((FARE_RULES.MIN_FARE_USD + extraKm * FARE_RULES.EXTRA_KM_RATE_USD) * 100) / 100;

      setEstimate({
        distanceKm,
        extraKm,
        durationMinutes: route.durationMinutes,
        finalFareUsd,
        minFareApplied: distanceKm <= FARE_RULES.BASE_DISTANCE_KM,
        path: route.path,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not calculate road distance.';
      setApiError(`${msg} You can still send your pinned locations directly on WhatsApp below.`);
    } finally {
      setIsCalculating(false);
    }
  };

  const buildWhatsAppBookingMessage = (): string => {
    if (!pickupPoint || !dropoffPoint) return '';

    const pickupLink = buildGoogleMapsPinUrl(pickupPoint.lat, pickupPoint.lng);
    const dropoffLink = buildGoogleMapsPinUrl(dropoffPoint.lat, dropoffPoint.lng);
    const formattedWhen = formatDisplayDateTime(pickupDate, pickupTime);

    const lines = [
      '*NEW TAXI BOOKING REQUEST*',
      '',
      `👤 *Client Name:* ${clientName.trim()}`,
      `📅 *Date & Time:* ${formattedWhen}`,
      '',
      `📍 *Pickup — ${pickupPoint.title}:*`,
      pickupLink,
      '',
      `🏁 *Drop-off — ${dropoffPoint.title}:*`,
      dropoffLink,
      '',
    ];

    if (estimate) {
      lines.push(`📏 *Distance:* ${estimate.distanceKm} km`);
      lines.push(`💰 *Estimated Fare:* ${formatPrice(estimate.finalFareUsd)}${estimate.minFareApplied ? ' (Minimum charge)' : ''}`);
    } else {
      lines.push('💰 *Estimated Fare:* Price on request (distance unavailable)');
    }

    if (notes.trim()) {
      lines.push('');
      lines.push(`📝 *Notes:* ${notes.trim()}`);
    }

    return lines.join('\n');
  };

  const handleBookWhatsApp = () => {
    if (!validateForm() || !pickupPoint || !dropoffPoint) return;
    const message = buildWhatsAppBookingMessage();
    window.open(`https://wa.me/${SECONDARY_PHONE_NUMBER_CLEAN}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleReset = () => {
    setEstimate(null);
    setApiError('');
    setFieldErrors({});
  };

  const handleSwapLocations = () => {
    setPickupText(dropoffText);
    setDropoffText(pickupText);
    setPickupPoint(dropoffPoint);
    setDropoffPoint(pickupPoint);
    setEstimate(null);
    setApiError('');
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.pickup;
      delete next.dropoff;
      return next;
    });
  };

  const todayDateStr = formatDateLocal(new Date());
  const hasScheduleSelected = Boolean(pickupDate && pickupTime);
  const errorCount = Object.keys(fieldErrors).length;

  return (
    <section id="fare-estimator" className="py-12 md:py-16 border-t border-gray-200/50 scroll-mt-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-taxi-yellow text-taxi-dark rounded-full font-bold text-xs tracking-wider uppercase mb-3">
            <Calculator className="w-4 h-4" />
            Fare Estimator & Booking
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Estimate Your Fare & Book</h2>
          <p className="mt-2 text-gray-600">
            Pin your exact Pickup & Drop-off locations to calculate distance and send your booking directly on WhatsApp.
          </p>
        </div>

        <form onSubmit={handleCalculateFare} noValidate className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 space-y-6">
            {/* Client Name */}
            <div>
              <label htmlFor="client-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Client Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="client-name"
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => { setClientName(e.target.value); clearError('clientName'); }}
                  placeholder="Enter your full name"
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-taxi-yellow focus:border-taxi-yellow text-sm ${
                    fieldErrors.clientName ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                  }`}
                />
              </div>
              {fieldErrors.clientName && (
                <p className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.clientName}
                </p>
              )}
            </div>

            {/* Pickup & Drop-off Locations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Route Locations
                </h3>
                {(pickupText || dropoffText || pickupPoint || dropoffPoint) && (
                  <button
                    type="button"
                    onClick={handleSwapLocations}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-taxi-dark bg-gray-100 hover:bg-taxi-yellow/30 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Swap Pickup & Drop-off
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LocationField
                  id="pickup-location"
                  label="Pickup Point"
                  target="pickup"
                  text={pickupText}
                  point={pickupPoint}
                  activePinTarget={activePinTarget}
                  locating={locatingTarget === 'pickup'}
                  error={fieldErrors.pickup}
                  placeholder="Search street, hotel, area..."
                  icon={<MapPin className="h-5 w-5 text-emerald-600" />}
                  onTextChange={(val) => {
                    setPickupText(val);
                    if (pickupPoint && val.trim() !== pickupPoint.title.trim()) {
                      setPickupPoint(null);
                      setEstimate(null);
                    }
                    clearError('pickup');
                  }}
                  onSelectPoint={(pt) => applySelectedPoint('pickup', pt)}
                  onLocateMe={() => handleLocateMe('pickup')}
                  onToggleMapPin={() => setActivePinTarget((prev) => (prev === 'pickup' ? null : 'pickup'))}
                />

                <LocationField
                  id="dropoff-location"
                  label="Drop-off Point"
                  target="dropoff"
                  text={dropoffText}
                  point={dropoffPoint}
                  activePinTarget={activePinTarget}
                  locating={locatingTarget === 'dropoff'}
                  error={fieldErrors.dropoff}
                  placeholder="Search destination in Lebanon..."
                  icon={<Navigation className="h-5 w-5 text-red-500" />}
                  onTextChange={(val) => {
                    setDropoffText(val);
                    if (dropoffPoint && val.trim() !== dropoffPoint.title.trim()) {
                      setDropoffPoint(null);
                      setEstimate(null);
                    }
                    clearError('dropoff');
                  }}
                  onSelectPoint={(pt) => applySelectedPoint('dropoff', pt)}
                  onLocateMe={() => handleLocateMe('dropoff')}
                  onToggleMapPin={() => setActivePinTarget((prev) => (prev === 'dropoff' ? null : 'dropoff'))}
                />
              </div>
            </div>

            {/* Interactive Google Map */}
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
              <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-gray-700">
                  {activePinTarget === 'pickup'
                    ? 'Click or tap on the map to set Pickup (A) — or drag markers to adjust'
                    : activePinTarget === 'dropoff'
                      ? 'Click or tap on the map to set Drop-off (B) — or drag markers to adjust'
                      : 'Drag markers (A / B) anytime to fine-tune your exact street corner'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActivePinTarget('pickup')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      activePinTarget === 'pickup' ? 'bg-taxi-dark text-taxi-yellow' : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    Set Pickup (A)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePinTarget('dropoff')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      activePinTarget === 'dropoff' ? 'bg-taxi-dark text-taxi-yellow' : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    Set Drop-off (B)
                  </button>
                </div>
              </div>

              {mapLoadError ? (
                <div className="p-6 text-center text-sm text-amber-800 bg-amber-50">
                  {mapLoadError} You can still use <strong>Locate Me</strong> above to pin your GPS coordinates.
                </div>
              ) : (
                <div ref={mapContainerRef} className="w-full h-64 md:h-72" />
              )}
            </div>

            {/* Spacious Date & Time Picker */}
            <div className="pt-2 border-t border-gray-100">
              <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-taxi-yellow" />
                    Pickup Date & Time <span className="text-red-500">*</span>
                  </label>
                  {hasScheduleSelected && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {formatDisplayDateTime(pickupDate, pickupTime)}
                    </span>
                  )}
                </div>

                {/* Quick time presets */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { id: 'asap', label: 'ASAP (~10 min)', action: () => handlePresetMinutes('asap', 10) },
                    { id: '30m', label: 'In 30 min', action: () => handlePresetMinutes('30m', 30) },
                    { id: '1h', label: 'In 1 hour', action: () => handlePresetMinutes('1h', 60) },
                    { id: 'tomorrow-9am', label: 'Tomorrow 9:00 AM', action: handlePresetTomorrowMorning },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={preset.action}
                      className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-all ${
                        selectedSchedulePreset === preset.id
                          ? 'bg-taxi-dark text-taxi-yellow border-taxi-dark shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-taxi-yellow hover:bg-amber-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Large separate Date and Time inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pickup-date" className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
                      Date
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="pickup-date"
                        type="date"
                        required
                        min={todayDateStr}
                        value={pickupDate}
                        onChange={(e) => {
                          setPickupDate(e.target.value);
                          setSelectedSchedulePreset(null);
                          clearError('dateTime');
                          setEstimate(null);
                        }}
                        className={`block w-full pl-11 pr-4 py-3.5 border rounded-xl bg-white focus:ring-2 focus:ring-taxi-yellow focus:border-taxi-yellow text-base font-medium ${
                          fieldErrors.dateTime && !pickupDate ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pickup-time" className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
                      Time
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Clock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="pickup-time"
                        type="time"
                        required
                        value={pickupTime}
                        onChange={(e) => {
                          setPickupTime(e.target.value);
                          setSelectedSchedulePreset(null);
                          clearError('dateTime');
                          setEstimate(null);
                        }}
                        className={`block w-full pl-11 pr-4 py-3.5 border rounded-xl bg-white focus:ring-2 focus:ring-taxi-yellow focus:border-taxi-yellow text-base font-medium ${
                          fieldErrors.dateTime && !pickupTime ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {fieldErrors.dateTime && (
                  <p className="mt-2.5 text-xs font-medium text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.dateTime}
                  </p>
                )}
              </div>
            </div>

            {errorCount > 0 && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Please complete all required fields marked with * above before calculating.
              </div>
            )}

            {/* Optional Notes */}
            <div>
              <label htmlFor="ride-notes" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Additional Notes (Optional)
              </label>
              <input
                id="ride-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Flight number, luggage count, building gate, extra stop..."
                className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-taxi-yellow focus:border-taxi-yellow text-sm"
              />
            </div>

            {apiError && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>{apiError}</span>
                </div>
                {pickupPoint && dropoffPoint && (
                  <button
                    type="button"
                    onClick={handleBookWhatsApp}
                    className="self-start inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 px-5 rounded-lg text-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Send Booking Request on WhatsApp
                  </button>
                )}
              </div>
            )}

            {!estimate ? (
              <button
                type="submit"
                disabled={isCalculating}
                className="w-full bg-taxi-yellow hover:bg-yellow-400 text-taxi-dark font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Calculating Exact Distance...
                  </>
                ) : (
                  <>
                    <Calculator className="w-5 h-5" />
                    Calculate Distance & Fare
                  </>
                )}
              </button>
            ) : (
              <div className="animate-fade-in-up">
                <div className="bg-taxi-dark text-white rounded-xl p-6 mb-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-gray-800 items-center">
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Total Distance</p>
                      <p className="text-3xl font-extrabold text-white mt-1">{estimate.distanceKm} km</p>
                      {estimate.durationMinutes && (
                        <p className="text-xs text-gray-400 mt-1 inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-taxi-yellow" /> ~{estimate.durationMinutes} min drive
                        </p>
                      )}
                    </div>

                    <div className="sm:text-right">
                      <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Estimated Fare</p>
                      <p className="text-4xl font-extrabold text-taxi-yellow mt-1">{formatPrice(estimate.finalFareUsd)}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {estimate.minFareApplied
                          ? `Minimum charge ${formatPrice(FARE_RULES.MIN_FARE_USD)} (up to ${FARE_RULES.BASE_DISTANCE_KM} km)`
                          : `${formatPrice(FARE_RULES.MIN_FARE_USD)} (first ${FARE_RULES.BASE_DISTANCE_KM} km) + ${estimate.extraKm} extra km × ${formatPrice(FARE_RULES.EXTRA_KM_RATE_USD)}`}
                      </p>
                    </div>
                  </div>

                  {pickupPoint && dropoffPoint && (
                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-300">
                      <a
                        href={buildGoogleMapsPinUrl(pickupPoint.lat, pickupPoint.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
                      >
                        <span className="truncate">
                          <strong className="text-emerald-400">Pickup:</strong> {pickupPoint.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-taxi-yellow" />
                      </a>
                      <a
                        href={buildGoogleMapsPinUrl(dropoffPoint.lat, dropoffPoint.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
                      >
                        <span className="truncate">
                          <strong className="text-red-400">Drop-off:</strong> {dropoffPoint.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-taxi-yellow" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={handleBookWhatsApp}
                    className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-4 rounded-xl shadow-md transition-all"
                  >
                    <MessageCircle className="w-6 h-6" />
                    Confirm & Book on WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold py-4 rounded-xl hover:bg-gray-50 transition-all"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Recalculate / Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          *Minimum charge is {formatPrice(FARE_RULES.MIN_FARE_USD)} for trips up to {FARE_RULES.BASE_DISTANCE_KM} km, plus {formatPrice(FARE_RULES.EXTRA_KM_RATE_USD)} per extra km. Final confirmation is sent on WhatsApp.
        </p>
      </div>
    </section>
  );
};
