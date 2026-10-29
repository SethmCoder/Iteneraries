"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Bookmark, Plus, Share2, Trash2 } from "lucide-react";
import {
  addPlaceToListAction,
  copyPlaceToListAction,
  createPlaceListAction,
  deletePlaceListAction,
  removePlaceFromListAction,
  renamePlaceListAction,
  sharePlaceListAction,
  unsharePlaceListAction,
  updatePlaceListItemAction,
} from "@/app/actions/saved-places";
import { addItineraryItemAction } from "@/app/actions/itinerary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Place, PlaceList, PlaceListItem, PlaceListShare } from "@/types/database";

type FriendOption = { id: string; username: string; display_name: string | null };
type TripOption = { id: string; name: string | null; destination_name: string | null };

type ListBundle = PlaceList & {
  items: (PlaceListItem & { places: Place | null })[];
  shares: PlaceListShare[];
  isSharedWithMe?: boolean;
};

export function SavedPlacesWorkspace({
  lists,
  sharedLists,
  friends,
  trips,
}: {
  lists: ListBundle[];
  sharedLists: ListBundle[];
  friends: FriendOption[];
  trips: TripOption[];
}) {
  const [selectedId, setSelectedId] = useState(
    lists[0]?.id ?? sharedLists[0]?.id ?? "",
  );
  const [newListName, setNewListName] = useState("");
  const [search, setSearch] = useState("");
  const [searchHits, setSearchHits] = useState<
    Array<{
      name: string;
      lat: number;
      lon: number;
      display_name: string;
      osm_type?: string | null;
      osm_id?: string | null;
    }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [shareFriendId, setShareFriendId] = useState("");
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");

  const all = useMemo(() => [...lists, ...sharedLists], [lists, sharedLists]);
  const selected = all.find((l) => l.id === selectedId) ?? null;
  const isOwner = selected ? lists.some((l) => l.id === selected.id) : false;

  async function runSearch(q: string) {
    setSearch(q);
    if (q.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchHits(data.results ?? []);
    } catch {
      setSearchHits([]);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="min-w-0 space-y-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Saved Places</h1>
          <p className="mt-1 text-sm text-muted">
            Lists of real places for itinerary planning.
          </p>
        </div>
        <div className="flex min-w-0 gap-2">
          <Input
            className="min-w-0 flex-1"
            placeholder="New list name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
          <Button
            className="shrink-0"
            disabled={pending || !newListName.trim()}
            onClick={() =>
              startTransition(async () => {
                try {
                  const row = await createPlaceListAction({ name: newListName });
                  setNewListName("");
                  setSelectedId(row.id);
                  setMessage("List created");
                } catch (e) {
                  setError((e as Error).message);
                }
              })
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted">Your lists</p>
          {lists.length === 0 ? (
            <p className="text-sm text-muted">No lists yet</p>
          ) : (
            lists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedId(l.id)}
                className={`block w-full rounded-[8px] px-3 py-2 text-left text-sm ${
                  selectedId === l.id
                    ? "bg-brand text-white"
                    : "hover:bg-brand-light"
                }`}
              >
                {l.name}
              </button>
            ))
          )}
        </div>
        {sharedLists.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted">
              Shared with me
            </p>
            {sharedLists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedId(l.id)}
                className={`block w-full rounded-[8px] px-3 py-2 text-left text-sm ${
                  selectedId === l.id
                    ? "bg-brand text-white"
                    : "hover:bg-brand-light"
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
        ) : null}
      </aside>

      <section className="space-y-4">
        {message ? <p className="text-sm text-success">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!selected ? (
          <div className="rounded-[12px] border border-dashed border-border bg-card p-8 text-center text-sm text-muted">
            <Bookmark className="mx-auto mb-2 h-8 w-8 text-brand/40" />
            Create a list to start saving places.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-[12px] border border-border bg-card p-4 shadow-sm">
              <div className="space-y-1.5">
                <Label>List name</Label>
                <Input
                  defaultValue={selected.name}
                  disabled={!isOwner}
                  onBlur={(e) => {
                    if (!isOwner || e.target.value === selected.name) return;
                    startTransition(async () => {
                      try {
                        await renamePlaceListAction({
                          listId: selected.id,
                          name: e.target.value,
                        });
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    });
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" asChild>
                  <Link href={`/suggester?listIds=${selected.id}`}>
                    Send to Suggester
                  </Link>
                </Button>
                {isOwner ? (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        if (!confirm("Delete this list?")) return;
                        try {
                          await deletePlaceListAction(selected.id);
                          setSelectedId("");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>

            {isOwner && friends.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2 rounded-[12px] border border-border bg-card p-4">
                <div className="min-w-[180px] flex-1 space-y-1.5">
                  <Label>Share with friend</Label>
                  <select
                    className="h-10 w-full rounded-[8px] border border-input bg-white px-3 text-sm"
                    value={shareFriendId}
                    onChange={(e) => setShareFriendId(e.target.value)}
                  >
                    <option value="">Select friend…</option>
                    {friends.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.display_name || f.username}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  disabled={!shareFriendId || pending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await sharePlaceListAction({
                          listId: selected.id,
                          friendUserId: shareFriendId,
                          permission: "view",
                        });
                        setMessage("List shared");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    })
                  }
                >
                  <Share2 className="h-4 w-4" />
                  Share view-only
                </Button>
                {selected.shares.map((s) => (
                  <Button
                    key={s.id}
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      startTransition(async () => {
                        await unsharePlaceListAction({
                          listId: selected.id,
                          friendUserId: s.friend_user_id,
                        });
                      })
                    }
                  >
                    Stop sharing
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2 rounded-[12px] border border-border bg-card p-4 shadow-sm">
              <Label>Search & save a place</Label>
              <Input
                value={search}
                onChange={(e) => void runSearch(e.target.value)}
                placeholder="Eiffel Tower, Paris"
              />
              {searchHits.length > 0 ? (
                <ul className="divide-y divide-border rounded-[8px] border border-border">
                  {searchHits.map((hit) => (
                    <li
                      key={`${hit.lat},${hit.lon},${hit.name}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{hit.name}</p>
                        <p className="truncate text-xs text-muted">
                          {hit.display_name}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              await addPlaceToListAction({
                                listId: selected.id,
                                name: hit.name,
                                latitude: hit.lat,
                                longitude: hit.lon,
                                address: hit.display_name,
                                osm_type: hit.osm_type ?? null,
                                osm_id: hit.osm_id ?? null,
                              });
                              setMessage(`Saved ${hit.name}`);
                              setSearch("");
                              setSearchHits([]);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          })
                        }
                      >
                        Save
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <ul className="space-y-2">
              {selected.items.length === 0 ? (
                <li className="rounded-[12px] border border-dashed border-border p-6 text-center text-sm text-muted">
                  No places in this list yet.
                </li>
              ) : (
                selected.items.map((item) => {
                  const place = item.places;
                  return (
                    <li
                      key={item.id}
                      className="rounded-[12px] border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {place?.name ?? "Place"}
                          </p>
                          <p className="text-xs text-muted">
                            {place?.address}
                            {place?.opening_hours_raw
                              ? ` · Hours: ${place.opening_hours_raw}`
                              : " · Hours unverified"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trips.length > 0 ? (
                            <>
                              <select
                                className="h-9 rounded-[8px] border border-input bg-white px-2 text-xs"
                                value={tripId}
                                onChange={(e) => setTripId(e.target.value)}
                              >
                                {trips.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name || t.destination_name || "Trip"}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!tripId || pending}
                                onClick={() =>
                                  startTransition(async () => {
                                    if (!place || !tripId) return;
                                    await addItineraryItemAction({
                                      tripId,
                                      title: place.name,
                                      item_type: "place",
                                      location_name: place.name,
                                      address: place.address,
                                      latitude: place.latitude,
                                      longitude: place.longitude,
                                      osm_id:
                                        place.osm_type && place.osm_id
                                          ? `${place.osm_type}/${place.osm_id}`
                                          : null,
                                      details: {
                                        source: "saved_places",
                                        placeId: place.id,
                                      },
                                    });
                                    setMessage("Added to trip");
                                  })
                                }
                              >
                                Add to trip
                              </Button>
                            </>
                          ) : null}
                          {lists.length > 1 ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const target = lists.find(
                                  (l) => l.id !== selected.id,
                                );
                                if (!target || !place) return;
                                startTransition(async () => {
                                  await copyPlaceToListAction({
                                    placeId: place.id,
                                    targetListId: target.id,
                                    notes: item.notes,
                                  });
                                  setMessage(`Copied to ${target.name}`);
                                });
                              }}
                            >
                              Copy to another list
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              startTransition(async () => {
                                await removePlaceFromListAction(item.id);
                              })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      <Input
                        className="mt-2"
                        placeholder="Notes"
                        defaultValue={item.notes ?? ""}
                        onBlur={(e) => {
                          if (e.target.value === (item.notes ?? "")) return;
                          startTransition(async () => {
                            await updatePlaceListItemAction({
                              itemId: item.id,
                              notes: e.target.value,
                              source_url: item.source_url,
                            });
                          });
                        }}
                      />
                    </li>
                  );
                })
              )}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
