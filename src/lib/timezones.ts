/**
 * Curated IANA timezone list for the profile timezone picker.
 * Values are canonical IANA names; labels show the UTC offset context.
 */

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Pacific/Midway", label: "Midway Island (UTC−11)" },
  { value: "Pacific/Honolulu", label: "Hawaii (UTC−10)" },
  { value: "America/Anchorage", label: "Alaska (UTC−9)" },
  { value: "America/Los_Angeles", label: "Pacific Time (UTC−8/−7)" },
  { value: "America/Denver", label: "Mountain Time (UTC−7/−6)" },
  { value: "America/Chicago", label: "Central Time (UTC−6/−5)" },
  { value: "America/New_York", label: "Eastern Time (UTC−5/−4)" },
  { value: "America/Halifax", label: "Atlantic Time (UTC−4/−3)" },
  { value: "America/St_Johns", label: "Newfoundland (UTC−3:30/−2:30)" },
  { value: "America/Sao_Paulo", label: "São Paulo (UTC−3)" },
  { value: "Atlantic/Azores", label: "Azores (UTC−1/+0)" },
  { value: "Europe/London", label: "London (UTC+0/+1)" },
  { value: "Europe/Berlin", label: "Berlin (UTC+1/+2)" },
  { value: "Europe/Helsinki", label: "Helsinki (UTC+2/+3)" },
  { value: "Europe/Moscow", label: "Moscow (UTC+3)" },
  { value: "Africa/Lagos", label: "Lagos (UTC+1)" },
  { value: "Africa/Nairobi", label: "Nairobi (UTC+3)" },
  { value: "Africa/Freetown", label: "Freetown (UTC+0)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Asia/Karachi", label: "Karachi (UTC+5)" },
  { value: "Asia/Kolkata", label: "Kolkata (UTC+5:30)" },
  { value: "Asia/Dhaka", label: "Dhaka (UTC+6)" },
  { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Australia/Perth", label: "Perth (UTC+8)" },
  { value: "Australia/Sydney", label: "Sydney (UTC+10/+11)" },
  { value: "Pacific/Auckland", label: "Auckland (UTC+12/+13)" },
  { value: "UTC", label: "UTC" },
];
