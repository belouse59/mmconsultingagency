const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const body = {
      email: registerForm.email.value,
      password: registerForm.password.value,
    };

    const res = await fetch("/api/loyalty/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    localStorage.setItem("customer", JSON.stringify(data.customer));
    window.location = "/loyalty/dashboard.html";
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const body = {
      email: loginForm.email.value,
      password: loginForm.password.value,
    };

    const res = await fetch("/api/loyalty/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    localStorage.setItem("customer", JSON.stringify(data.customer));
    window.location = "/loyalty/dashboard.html";
  });
}