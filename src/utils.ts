// Function to toggle settings visibility
function toggleSettings(): void {
    const gearButton: HTMLElement | null = document.getElementById('linkBtn'); // Get the gear button element
    const togglePart: HTMLElement | null = document.getElementById('togglePart'); // Get the toggle part element
    const aside: HTMLElement | null = document.getElementById('aside'); // Get the aside element

    if (!gearButton || !togglePart || !aside) { // Check if elements are found
        console.error('Button or section not found'); // Log error if any element is not found
        return; // Exit the function
    }

    togglePart.classList.toggle('hidden'); // Toggle the 'hidden' class on togglePart
    aside.classList.toggle('hidden'); // Toggle the 'hidden' class on aside
}

// Code to synchronize input values with text elements
const inputIds = ['filamentDiameter', 'upperLimit', 'lowestLimit', 'spoolNumber', 'batchNumber']; // Array of input element IDs
const textIds = ['filamentDiameterText', 'upperLimitText', 'lowestLimitText', 'spoolNumberText', 'batchNumberText']; // Array of corresponding text element IDs

inputIds.forEach((inputId, index) => { // Iterate over inputIds array
    const inputElement = document.getElementById(inputId) as HTMLInputElement; // Get the input element by ID
    const textElement = document.getElementById(textIds[index]); // Get the corresponding text element by ID

    if (inputElement && textElement) { // Check if both elements are found
        inputElement.addEventListener('input', () => { // Add input event listener to input element
            textElement.textContent = inputElement.value; // Update text element content with input value
        });
    } else {
        console.error(`Element with id ${inputId} or ${textIds[index]} not found`); // Log error if any element is not found
    }
});
