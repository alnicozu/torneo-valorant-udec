// Auspiciadores que aparecen en la portada (arriba y en su propia sección).
// Para agregar otro, suma un elemento a la lista y deja su logo (cuadrado) en public/auspiciadores/.
// Los montos de aporte NO se publican.
export type Auspiciador = {
  nombre: string;
  descripcion: string;
  logo: string;
  url?: string;
};

export const AUSPICIADORES: Auspiciador[] = [
  {
    nombre: 'Casa Pastrana',
    descripcion: 'Tienda de artículos de juegos vintage · Concepción',
    logo: '/auspiciadores/casa-pastrana.png',
  },
];
