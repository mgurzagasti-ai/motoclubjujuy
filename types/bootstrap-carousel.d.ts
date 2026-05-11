declare module "bootstrap/js/dist/carousel" {
  type CarouselOptions = {
    interval?: number | false;
    keyboard?: boolean;
    pause?: "hover" | false;
    ride?: "carousel" | boolean;
    touch?: boolean;
    wrap?: boolean;
  };

  export default class Carousel {
    constructor(element: Element, options?: CarouselOptions);
    static getOrCreateInstance(element: Element, options?: CarouselOptions): Carousel;
    cycle(): void;
    pause(): void;
    next(): void;
    prev(): void;
    dispose(): void;
  }
}
