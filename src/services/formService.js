

// async function handleForm(data) {
//   if (!data.formType || !["contact", "newsletter", "simulator"].includes(data.formType)) {
//     return { status: "error", message: "Invalid form type" };
//   }

//   if (data.email && isRateLimited(data.email)) {
//     return { status: "error", message: "Too many requests" };
//   }

//   switch (data.formType) {
//     case "contact":
//       return handleContact(data);
//     case "newsletter":
//       return handleNewsletter(data);
//     case "simulator":
//       return handleSimulator(data);
//   }
// }

// function handleNewsletter(data) {
//   if (!data.email || !isValidEmail(data.email)) {
//     return { status: "error", message: "Invalid email" };
//   }

//   // TODO: DB insert later
//   return { status: "success", message: "Subscribed" };
// }

// function handleContact(data) {
//   return { status: "success", message: "Contact received" };
// }

// function handleSimulator(data) {
//   return { status: "success", message: "Simulator saved" };
// }

// module.exports = { handleForm };