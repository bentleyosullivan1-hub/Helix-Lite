const modal=document.getElementById('gameModal'),mount=document.getElementById('gameMount');
const grid=document.getElementById('gameGrid'),search=document.getElementById('gameSearch');
const filters=[...document.querySelectorAll('.filter')],gameCount=document.getElementById('gameCount');
const fullscreenGame=document.getElementById('fullscreenGame');
const artSymbols=['✦','◇','◉','8','△','✧'];

function makeCard(game,index){
	const title=game.title,category=game.category||'arcade',card=document.createElement('article');
	card.className='game-card';
	card.dataset.tags=category;
	card.innerHTML=`<div class="game-art art${index%6+1}"><span>${artSymbols[index%artSymbols.length]}</span></div>
		<div class="game-info"><div class="game-meta"><small>${category.toUpperCase()} / ${String(index+1).padStart(3,'0')}</small><span class="category-tag">${category}</span></div>
		<h3></h3><p>Launch ${title} in the Helix arcade.</p>
		<button class="btn primary launchGame" type="button">LAUNCH →</button></div>`;
	card.querySelector('h3').textContent=title;
	card.querySelector('.launchGame').dataset.file=game.file;
	return card;
}

function filterGames(){
	const query=(search.value||'').toLowerCase(),active=document.querySelector('.filter.active').dataset.filter;
	grid.querySelectorAll('.game-card').forEach(card=>{
		// textContent, not innerText — innerText returns "" for elements
		// currently display:none, which would make a previously-hidden
		// card impossible to match again even after broadening the query.
		card.style.display=(!query||card.textContent.toLowerCase().includes(query))&&(active==='all'||card.dataset.tags===active)?'':'none';
	});
}

async function loadGames(){
	try{
		const response=await fetch('games/list.json');
		if(!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
		const games=await response.json();
		grid.replaceChildren(...games.map(makeCard));
		gameCount.textContent=String(games.length).padStart(2,'0');
		filterGames();
	}catch(error){
		grid.innerHTML='<p class="game-loading">Unable to load the arcade manifest. Serve this site over HTTP to load games.</p>';
		console.error(error);
	}
}

grid.addEventListener('click',event=>{
	const button=event.target.closest('.launchGame');
	if(!button) return;
	mount.innerHTML=`<iframe title="${button.closest('.game-card').querySelector('h3').textContent}" allowfullscreen sandbox="allow-scripts allow-forms allow-pointer-lock" src="games/${encodeURIComponent(button.dataset.file)}"></iframe>`;
	modal.classList.add('show');
});
fullscreenGame.onclick=async()=>{
	const iframe=mount.querySelector('iframe');
	if(!iframe) return;
	try{
		if(document.fullscreenElement) await document.exitFullscreen();
		else await iframe.requestFullscreen();
	}catch(error){
		console.error('Fullscreen unavailable',error);
	}
};
document.getElementById('closeGame').onclick=()=>modal.classList.remove('show');
modal.onclick=event=>{if(event.target===modal) modal.classList.remove('show')};
search.oninput=filterGames;
filters.forEach(button=>button.onclick=()=>{filters.forEach(item=>item.classList.remove('active'));button.classList.add('active');filterGames()});
loadGames();
