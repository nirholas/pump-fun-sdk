/**
 * @pumpkit/core — Storage Interface
 */

export interface Store<T> {
  /** Read the current stored value */
  read(): T;
  /** Write a new value to storage */
  write(data: T): void;
}
