-- Generic sport outcome position keys: binary PO/JO, native football home/draw/away,
-- legacy named outcomes, and F1 driver codes. RPCs still validate sides against each market.
alter table public.positions drop constraint if exists positions_side_check;
alter table public.positions add constraint positions_side_check check (
  side in ('PO', 'JO', 'home', 'draw', 'away')
  or side ~ '^[A-Z][A-Z_ -]{1,79}$'
);
