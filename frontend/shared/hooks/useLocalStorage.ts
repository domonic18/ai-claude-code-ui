import { useState } from 'react';

/**
 * Custom hook to persist state in localStorage with TypeScript support.
 *
 * @template T - The type of the stored value
 * @param key - The key to use for localStorage
 * @param initialValue - The initial value to use if nothing is in localStorage
 * @returns A tuple containing the stored value and a setter function
 */
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)): void => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      setStoredValue(valueToStore);
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
}

export default useLocalStorage;
