/** Site-wide notice shown above the header while the store is out of service. */
export function MaintenanceBanner() {
  return (
    <div className="bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
      We are out of service now. Please check back later.
    </div>
  );
}
