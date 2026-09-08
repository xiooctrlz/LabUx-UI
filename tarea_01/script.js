const botonArriba = document.querySelector('.ir-arriba');

window.addEventListener('scroll', function () {

    if (window.scrollY > 100) {
        botonArriba.classList.add('show');
    } else {
        botonArriba.classList.remove('show');
    }

});

document.querySelector ('.ir-arriba')
.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});