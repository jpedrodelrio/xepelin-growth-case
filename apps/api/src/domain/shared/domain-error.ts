/** Error base del dominio. Las violaciones de invariantes lanzan estas excepciones. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Se intentó una transición de estado no permitida por la máquina de estados. */
export class InvalidTransitionError extends DomainError {
  constructor(entity: string, from: string, to: string) {
    super(`Transición inválida en ${entity}: ${from} → ${to}`);
  }
}
