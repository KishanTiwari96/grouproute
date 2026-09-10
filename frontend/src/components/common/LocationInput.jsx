import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Loader2, Navigation } from 'lucide-react';
import LocationPickerModal from '../map/LocationPickerModal.jsx';

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function LocationInput({ 
  label, 
  placeholder, 
  value, // { address, lat, lng } | null
  onChange,
  icon: Icon = MapPin,
  iconColor = "text-[#1a73e8]"
}) {
  const [query, setQuery] = useState(value?.address || '');
  const debouncedQuery = useDebounce(query, 500);
  
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  
  const wrapperRef = useRef(null);

  // Sync external value changes (e.g., presets applied or map picker selection)
  useEffect(() => {
    if (!value || !value.address) {
      setQuery('');
      return;
    }

    if (value.address !== query) {
      setQuery(value.address);
    }
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions from Nominatim
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    // Don't search if the query exactly matches the current selected value
    if (value && debouncedQuery === value.address) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedQuery)}&limit=5&countrycodes=in`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          setSuggestions(data || []);
          setIsDropdownOpen(true);
        }
      })
      .catch(err => {
        console.error("Geocoding autocomplete failed", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [debouncedQuery, value]);

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setQuery(nextValue);

    if (nextValue.trim() === '') {
      onChange(null);
      return;
    }

    if (value && value.address && nextValue === value.address) {
      return;
    }

    // Keep the chosen value consistent while typing, but do not overwrite with a partial string.
    onChange({
      address: nextValue,
      lat: value?.lat ?? null,
      lng: value?.lng ?? null
    });
  };

  const handleSelectSuggestion = (suggestion) => {
    const newLoc = {
      address: String(suggestion.display_name || '').trim(),
      lat: Number(suggestion.lat),
      lng: Number(suggestion.lon)
    };
    setQuery(newLoc.address);
    onChange(newLoc);
    setIsDropdownOpen(false);
  };

  const handleMapPickerConfirm = (loc) => {
    const normalizedLoc = {
      address: String(loc?.address || '').trim(),
      lat: Number(loc?.lat),
      lng: Number(loc?.lng)
    };
    setQuery(normalizedLoc.address);
    onChange(normalizedLoc);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-bold text-[#3c4043] mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon className={`w-5 h-5 ${iconColor} absolute left-3.5 top-1/2 transform -translate-y-1/2`} />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => { if (suggestions.length > 0) setIsDropdownOpen(true); }}
            placeholder={placeholder}
            className="w-full pl-11 pr-10 py-3 rounded-[10px] bg-white border border-[#dadce0] text-[#202124] text-sm focus:outline-none focus:border-[#1a73e8] focus:shadow-[0_0_0_2px_rgba(26,115,232,0.2)] transition-shadow"
          />
          {isLoading && (
            <div className="absolute right-3.5 top-1/2 transform -translate-y-1/2">
              <Loader2 className="w-4 h-4 text-[#5f6368] animate-spin" />
            </div>
          )}
        </div>
        
        {/* Map Picker Button */}
        <button
          type="button"
          onClick={() => setIsMapPickerOpen(true)}
          title="Pick on map"
          className="shrink-0 w-[46px] h-[46px] rounded-[10px] border border-[#dadce0] bg-white flex items-center justify-center text-[#5f6368] hover:text-[#1a73e8] hover:bg-[#e8f0fe] hover:border-[#1a73e8] transition-all"
        >
          <Navigation className="w-5 h-5" />
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {isDropdownOpen && suggestions.length > 0 && (
        <ul className="absolute z-[100] w-[calc(100%-54px)] mt-1 bg-white border border-[#dadce0] rounded-[10px] shadow-lg max-h-60 overflow-y-auto overflow-x-hidden">
          {suggestions.map((s, idx) => (
            <li 
              key={idx}
              onClick={() => handleSelectSuggestion(s)}
              className="px-4 py-3 hover:bg-[#f1f3f4] cursor-pointer border-b border-[#f1f3f4] last:border-0 flex items-start gap-3 transition-colors"
            >
              <MapPin className="w-4 h-4 text-[#5f6368] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#202124] line-clamp-1">{s.display_name.split(',')[0]}</p>
                <p className="text-xs text-[#5f6368] line-clamp-1">{s.display_name.split(',').slice(1).join(',').trim()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Picker Modal */}
      <LocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onLocationSelected={handleMapPickerConfirm}
        defaultLocation={value}
      />
    </div>
  );
}
