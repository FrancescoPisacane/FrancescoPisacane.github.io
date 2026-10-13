// Places where Francesco studied or worked, in chronological order.
// school: true marks places outside university. The opening animation skips them.
// travel: seconds to fly here from the previous stop. dwell: seconds the popup stays. z: camera distance.
window.PLACES = [
  { id: "varese",     school: true, city: "Varese, Italy", title: "Applied Sciences High School", note: "Liceo Scientifico Galileo Ferraris · 2016–2021", lat: 45.82, lon: 8.83, travel: 2.6, dwell: 2.2, z: 2.8 },
  { id: "milano",     city: "Milan, Italy",         title: "Politecnico di Milano",              note: "BSc 2021–2024 · MSc 2024–present",           lat: 45.48, lon: 9.23,  travel: 3.0, dwell: 2.8, z: 2.8 },
  { id: "zurich",     city: "Zurich, Switzerland",  title: "ETH Zurich",                         note: "Summer school in applied geophysics · IDEA League", lat: 47.38, lon: 8.55, travel: 1.7, dwell: 2.4, z: 2.8 },
  { id: "ghent",      city: "Ghent, Belgium",       title: "Ghent University",                   note: "Exchange in electromechanical engineering · Sep 2025 – Jan 2026", lat: 51.05, lon: 3.72, travel: 1.9, dwell: 2.6, z: 2.8 },
  { id: "delft",      city: "Delft, Netherlands",   title: "TU Delft",                           note: "IDEA League Challenge Programme",            lat: 52.00, lon: 4.37,  travel: 1.4, dwell: 2.1, z: 2.8 },
  { id: "aachen",     city: "Aachen, Germany",      title: "RWTH Aachen University",             note: "IDEA League Challenge Programme",            lat: 50.78, lon: 6.08,  travel: 1.4, dwell: 2.1, z: 2.8 },
  { id: "gothenburg", city: "Gothenburg, Sweden",   title: "Chalmers University of Technology", note: "IDEA League Challenge Programme",            lat: 57.69, lon: 11.97, travel: 1.9, dwell: 2.1, z: 2.8 },
  { id: "pasadena",   city: "Pasadena, USA",        title: "NASA Jet Propulsion Laboratory",     note: "Master's thesis research · Mar – Sep 2026", img: "assets/jpl.jpg",   lat: 34.2,  lon: -118.17, travel: 3.2, dwell: 3.0, z: 3.0 }
];
