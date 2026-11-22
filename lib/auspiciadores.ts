// Auspiciadores que aparecen en la portada. Para agregar otro, suma un elemento a la lista
// y deja su logo (cuadrado) en public/auspiciadores/.
export type Auspiciador = {
  nombre: string;
  descripcion: string;
  logo: string;
  aporte?: string;
  url?: string;
};

export const AUSPICIADORES: Auspiciador[] = [
  {
    nombre: 'Casa Pastrana',
    descripcion: 'Tienda de artículos de juegos vintage · Concepción',
    logo: '/auspiciadores/casa-pastrana.png',
    aporte: '$25.000 de aporte',
  },
];
