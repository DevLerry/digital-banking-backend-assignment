/**
 * A failure that came from the NibssByPhoenix API (not from our own code).
 *
 * Why a custom class: when something breaks at 2am you need to know instantly
 * whether the bug is *ours* or *theirs*. Carrying the upstream status and body
 * means our error handler can report precisely what NIBSS said, instead of a
 * generic "Request failed".
 */
export class NibssError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = 'NibssError';
  }
}
