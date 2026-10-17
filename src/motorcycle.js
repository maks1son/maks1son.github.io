const images = {
  '#657966': 'ural-blue.png',
  '#647b69': 'ural-blue.png',
  '#40555f': 'ural-black.png',
  '#8e6d53': 'ural-black.png',
  '#708184': 'ural-blue.png',
  '#934c46': 'ural-solo.png',
  '#687c67': 'ural-blue.png',
};
export function motorcycle(color = '#657966', big = false) {
  const file = images[color];
  if (!file) return '<div class="photo-placeholder"><span>Нет фото</span></div>';
  return `<img src="/images/${file}" class="motorcycle ${big ? 'big' : ''}" alt="Сгенерированное изображение мотоцикла для учебного примера" decoding="sync">`;
}
