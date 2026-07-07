document.addEventListener("DOMContentLoaded", async () => {
    // Grab the ID from the global listingData object defined in show.ejs
    const listingId = listingData._id;
    let disabledDates = [];
    
    try {
        // Fetch the array of dates already booked by others
        const response = await fetch(`/listings/${listingId}/booked-dates`);
        disabledDates = await response.json();
    } catch(e) {
        console.error("Could not load booked dates");
    }

    const checkInInput = document.getElementById("checkIn");
    const checkOutInput = document.getElementById("checkOut");

    // Initialize the Range Calendar
    const fp = flatpickr(checkInInput, {
        mode: "range",
        minDate: "today",
        disable: disabledDates,
        dateFormat: "Y-m-d",
        showMonths: window.innerWidth > 768 ? 2 : 1, // Shows 2 months on desktop, 1 on mobile
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 1) {
                checkInInput.value = instance.formatDate(selectedDates[0], "M j, Y");
                checkOutInput.value = "";
            } else if (selectedDates.length === 2) {
                checkInInput.value = instance.formatDate(selectedDates[0], "M j, Y");
                checkOutInput.value = instance.formatDate(selectedDates[1], "M j, Y");
            }
        }
    });
    
    // Allow clicking anywhere on the input box container to open the calendar
    document.getElementById("datePickerContainer").addEventListener("click", () => {
        fp.open();
    });
});