/* -------------------------
   LOGOUT
------------------------- */
export function logout(el, url){

    //$logout?.addEventListener("click", () => {
    el?.addEventListener("click", () => {
       // window.location.href = "/loyalty/customer/login.html";
        window.location.href = url;
    });
}