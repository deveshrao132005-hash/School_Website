
async function submitForm(form, type) {
  const button = form.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Sending...";

  const data = Object.fromEntries(new FormData(form).entries());
  data.type = type;

  try {
    const response = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to submit form.");

    form.reset();
    alert("Thank you! Your enquiry has been submitted successfully.");
  } catch (error) {
    alert(error.message || "Something went wrong. Please try again.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const admissionForm = document.getElementById("admission-form");
  if (admissionForm) {
    admissionForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitForm(admissionForm, "admission");
    });
  }

  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitForm(contactForm, "contact");
    });
  }
});
