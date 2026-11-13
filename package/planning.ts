/** Identifier shared by planning resources across Gantt, Scheduler, and Kanban. */
export type ResourceIdentityId = string | number;

/**
 * Product-neutral identity for a person, team, location, or other schedulable
 * resource. Product packages extend this shape with capacity and calendar data.
 */
export interface ResourceIdentity<Id extends ResourceIdentityId = ResourceIdentityId> {
  readonly id: Id;
  readonly name: string;
  readonly avatarUrl?: string;
  readonly role?: string;
  readonly metadata?: Record<string, unknown>;
}
