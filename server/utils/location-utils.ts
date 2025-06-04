// Utilitários para cálculo de distância entre cidades
// Usando coordenadas aproximadas das principais cidades brasileiras

interface CityCoordinates {
  [key: string]: { lat: number; lng: number };
}

// Base de dados de coordenadas das principais cidades brasileiras
const cityCoordinates: CityCoordinates = {
  // Rio Grande do Sul
  'tres passos': { lat: -27.4536, lng: -53.9311 },
  'porto alegre': { lat: -30.0346, lng: -51.2177 },
  'caxias do sul': { lat: -29.1678, lng: -51.1794 },
  'santa maria': { lat: -29.6842, lng: -53.8069 },
  'pelotas': { lat: -31.7654, lng: -52.3376 },
  'canoas': { lat: -29.9177, lng: -51.1830 },
  'novo hamburgo': { lat: -29.6783, lng: -51.1306 },
  'são leopoldo': { lat: -29.7594, lng: -51.1248 },
  'rio grande': { lat: -32.0350, lng: -52.0986 },
  'alvorada': { lat: -29.9897, lng: -51.0814 },
  'gravataí': { lat: -29.9441, lng: -50.9925 },
  'viamão': { lat: -30.0811, lng: -51.0233 },
  'uruguaiana': { lat: -29.7546, lng: -57.0883 },
  'santa cruz do sul': { lat: -29.7161, lng: -52.4264 },
  'cachoeirinha': { lat: -29.9511, lng: -51.0944 },
  'bagé': { lat: -31.3314, lng: -54.1069 },
  'bento gonçalves': { lat: -29.1669, lng: -51.5189 },
  'erechim': { lat: -27.6339, lng: -52.2750 },
  'guaíba': { lat: -30.1142, lng: -51.3250 },
  'santana do livramento': { lat: -30.8906, lng: -55.5322 },
  'frederico westphalen': { lat: -27.3594, lng: -53.3939 },
  'ijuí': { lat: -28.3878, lng: -53.9147 },
  'passo fundo': { lat: -28.2620, lng: -52.4064 },
  'santa rosa': { lat: -27.8717, lng: -54.4811 },
  'cruz alta': { lat: -28.6392, lng: -53.6064 },
  'palmeira das missões': { lat: -27.8994, lng: -53.3133 },
  'carazinho': { lat: -28.2836, lng: -52.7864 },
  'santo angelo': { lat: -28.2994, lng: -54.2631 },
  'alegrete': { lat: -29.7833, lng: -55.7919 },
  
  // São Paulo
  'são paulo': { lat: -23.5505, lng: -46.6333 },
  'campinas': { lat: -22.9099, lng: -47.0626 },
  'santos': { lat: -23.9618, lng: -46.3322 },
  'são bernardo do campo': { lat: -23.6939, lng: -46.5650 },
  'guarulhos': { lat: -23.4538, lng: -46.5333 },
  'osasco': { lat: -23.5329, lng: -46.7917 },
  'santo andré': { lat: -23.6586, lng: -46.5311 },
  'são josé dos campos': { lat: -23.2237, lng: -45.9009 },
  'ribeirão preto': { lat: -21.1775, lng: -47.8103 },
  'sorocaba': { lat: -23.5015, lng: -47.4526 },
  
  // Rio de Janeiro
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
  'niterói': { lat: -22.8833, lng: -43.1036 },
  'nova iguaçu': { lat: -22.7592, lng: -43.4511 },
  'duque de caxias': { lat: -22.7856, lng: -43.3117 },
  'belford roxo': { lat: -22.7642, lng: -43.3997 },
  'campos dos goytacazes': { lat: -21.7642, lng: -41.3297 },
  'petrópolis': { lat: -22.5050, lng: -43.1781 },
  'volta redonda': { lat: -22.5231, lng: -44.1042 },
  
  // Minas Gerais
  'belo horizonte': { lat: -19.9191, lng: -43.9386 },
  'uberlândia': { lat: -18.9113, lng: -48.2622 },
  'contagem': { lat: -19.9320, lng: -44.0536 },
  'juiz de fora': { lat: -21.7642, lng: -43.3503 },
  'betim': { lat: -19.9681, lng: -44.1983 },
  'montes claros': { lat: -16.7286, lng: -43.8614 },
  'uberaba': { lat: -19.7483, lng: -47.9317 },
  'governador valadares': { lat: -18.8511, lng: -41.9494 },
  'ipatinga': { lat: -19.4681, lng: -42.5369 },
  
  // Outros estados principais
  'brasília': { lat: -15.7939, lng: -47.8828 },
  'salvador': { lat: -12.9714, lng: -38.5014 },
  'fortaleza': { lat: -3.7319, lng: -38.5267 },
  'recife': { lat: -8.0476, lng: -34.8770 },
  'manaus': { lat: -3.1190, lng: -60.0217 },
  'belém': { lat: -1.4558, lng: -48.5044 },
  'goiânia': { lat: -16.6864, lng: -49.2643 },
  'curitiba': { lat: -25.4284, lng: -49.2733 },
  'florianópolis': { lat: -27.5954, lng: -48.5480 },
  'vitória': { lat: -20.3155, lng: -40.3128 },
  'natal': { lat: -5.7945, lng: -35.2110 },
  'joão pessoa': { lat: -7.1195, lng: -34.8450 },
  'aracaju': { lat: -10.9472, lng: -37.0731 },
  'maceió': { lat: -9.6658, lng: -35.7353 },
  'teresina': { lat: -5.0892, lng: -42.8016 },
  'são luís': { lat: -2.5387, lng: -44.2829 },
  'campo grande': { lat: -20.4697, lng: -54.6201 },
  'cuiabá': { lat: -15.6014, lng: -56.0979 },
  'porto velho': { lat: -8.7619, lng: -63.9039 },
  'boa vista': { lat: 2.8235, lng: -60.6758 },
  'rio branco': { lat: -9.9754, lng: -67.8249 },
  'macapá': { lat: 0.0389, lng: -51.0664 },
  'palmas': { lat: -10.1689, lng: -48.3317 },
};

/**
 * Calcula a distância entre duas coordenadas usando a fórmula de Haversine
 * @param lat1 Latitude do ponto 1
 * @param lng1 Longitude do ponto 1
 * @param lat2 Latitude do ponto 2
 * @param lng2 Longitude do ponto 2
 * @returns Distância em quilômetros
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return Math.round(distance);
}

/**
 * Obtém as coordenadas de uma cidade
 * @param cityName Nome da cidade (normalizado para minúsculas)
 * @returns Coordenadas da cidade ou null se não encontrada
 */
export function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  const normalizedCity = cityName.toLowerCase().trim();
  return cityCoordinates[normalizedCity] || null;
}

/**
 * Calcula a distância entre duas cidades
 * @param city1 Nome da primeira cidade
 * @param city2 Nome da segunda cidade
 * @returns Distância em quilômetros ou null se alguma cidade não for encontrada
 */
export function getDistanceBetweenCities(city1: string, city2: string): number | null {
  const coords1 = getCityCoordinates(city1);
  const coords2 = getCityCoordinates(city2);
  
  if (!coords1 || !coords2) {
    return null;
  }
  
  return calculateDistance(coords1.lat, coords1.lng, coords2.lat, coords2.lng);
}

/**
 * Filtra serviços por proximidade à cidade do usuário
 * @param services Lista de serviços
 * @param userCity Cidade do usuário
 * @param maxDistance Distância máxima em km (padrão: 50km)
 * @returns Serviços filtrados por proximidade
 */
export function filterServicesByProximity(services: any[], userCity: string, maxDistance: number = 50): any[] {
  if (!userCity) return services;
  
  return services.filter(service => {
    if (!service.partner?.city) return false;
    
    const distance = getDistanceBetweenCities(userCity, service.partner.city);
    return distance !== null && distance <= maxDistance;
  });
}

/**
 * Adiciona informação de distância aos serviços
 * @param services Lista de serviços
 * @param userCity Cidade do usuário
 * @returns Serviços com informação de distância adicionada
 */
export function addDistanceToServices(services: any[], userCity: string): any[] {
  if (!userCity) return services;
  
  return services.map(service => {
    if (!service.partner?.city) {
      return { ...service, distance: null };
    }
    
    const distance = getDistanceBetweenCities(userCity, service.partner.city);
    return { ...service, distance };
  });
}