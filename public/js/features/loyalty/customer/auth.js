const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");

const saveCustomer = (customer) => {
  localStorage.setItem("loyaltyCustomer", JSON.stringify(customer));
};

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const body = {
      identifier: registerForm.identifier.value,
      password: registerForm.password.value,
    };

    const res = await fetch("/api/loyalty/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Registration failed");
      return;
    }

    saveCustomer(data.customer);
    window.location.href = "/loyalty/dashboard.html";
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const body = {
      identifier: loginForm.identifier.value,
      password: loginForm.password.value,
    };

    const res = await fetch("/api/loyalty/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Login failed");
      return;
    }

    saveCustomer(data.customer);
    window.location.href = "/loyalty/dashboard.html";
  });
}