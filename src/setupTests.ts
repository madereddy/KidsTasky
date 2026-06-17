import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('motion/react', async () => {
  const { createElement, forwardRef, Fragment } = await import('react');

  const stripMotionProps = ({ children, initial, animate, exit, variants, transition, whileHover, whileTap, whileFocus, whileDrag, whileInView, layout, layoutId, drag, dragConstraints, dragElastic, dragMomentum, onAnimationComplete, onAnimationStart, onDragStart, onDragEnd, onDrag, style, ...rest }: any) =>
    ({ children, style, ...rest });

  const makeElement = (tag: string) =>
    forwardRef((props: any, ref: any) => {
      const { children, style, ...rest } = stripMotionProps(props);
      return createElement(tag, { ...rest, style, ref }, children);
    });

  const motion = new Proxy({} as Record<string, ReturnType<typeof makeElement>>, {
    get: (cache, key: string) => cache[key] ?? (cache[key] = makeElement(key)),
  });

  const noopValue = (v: any = 0) => ({ get: () => v, set: vi.fn(), subscribe: vi.fn(() => () => {}), on: vi.fn() });

  return {
    motion,
    AnimatePresence: ({ children }: any) => createElement(Fragment, null, children),
    useMotionValue: noopValue,
    useTransform: (_v: any, _from: any, to: any) => noopValue(Array.isArray(to) ? to[0] : to),
    useSpring: noopValue,
    useAnimation: () => ({ start: vi.fn(() => Promise.resolve()), stop: vi.fn(), set: vi.fn() }),
    useInView: () => [null, false],
    useScroll: () => ({ scrollX: noopValue(0), scrollY: noopValue(0) }),
    m: new Proxy({} as Record<string, ReturnType<typeof makeElement>>, {
      get: (cache, key: string) => cache[key] ?? (cache[key] = makeElement(key)),
    }),
  };
});

// Mock browser APIs that jsdom lacks
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
